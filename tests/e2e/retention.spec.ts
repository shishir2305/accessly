import { test, expect } from "@playwright/test";
import { identity, app, call, waitRun } from "./helpers";
import { getDb, closeDb, evidence, eq } from "../../packages/database/src";
import { expireEvidence } from "../../packages/database/src/mvp";
test("opt-in retention removes only expired workspace screenshots and preserves results and history", async ({
  request,
}) => {
  const owner = await identity(),
    other = await identity();
  const images: any[] = [];
  try {
    for (const user of [owner, other]) {
      const application = await app(request, user.token);
      const response = await call(request, user.token, "runs/public", "POST", {
        applicationId: application.id,
        environmentId: application.environments[0].id,
        url: "http://127.0.0.1:4174/public",
        screenshot: true,
      });
      const runId = (await response.json()).id;
      await waitRun(request, user.token, runId);
      let run: any;
      await expect
        .poll(
          async () => {
            run = await (
              await call(request, user.token, `runs/${runId}`)
            ).json();
            return run.evidenceState;
          },
          { timeout: 30000 },
        )
        .toBe("ready");
      const image = run.evidence.find((e: any) => e.status === "ready");
      await getDb()
        .update(evidence)
        .set({ createdAt: new Date(Date.now() - 2 * 86400000) })
        .where(eq(evidence.id, image.id));
      images.push({ user, run, image });
    }
    expect(
      (await (await call(request, owner.token, "settings")).json())
        .retentionDays,
    ).toBe(null);
    expect(
      (
        await call(request, owner.token, "settings", "POST", {
          retentionDays: 1,
          reason: "Expire screenshots for this controlled workspace only.",
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await (await call(request, other.token, "settings")).json())
        .retentionDays,
    ).toBe(null);
    await expireEvidence();
    expect(
      (
        await call(request, owner.token, `evidence/${images[0].image.id}`)
      ).status(),
    ).toBe(410);
    const remaining = await call(
      request,
      other.token,
      `evidence/${images[1].image.id}`,
    );
    expect(remaining.ok()).toBe(true);
    expect((await request.get((await remaining.json()).url)).ok()).toBe(true);
    const result = await (
      await call(request, owner.token, `runs/${images[0].run.id}`)
    ).json();
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.evidenceState).toBe("deleted");
    expect(result.evidence[0].deletedAt).toBeTruthy();
    expect(
      (
        await call(request, other.token, `evidence/${images[0].image.id}`)
      ).status(),
    ).toBe(404);
    const source = images[1],
      imageURL = (
        await (
          await call(request, other.token, `evidence/${source.image.id}`)
        ).json()
      ).url;
    const bytes = await (await request.get(imageURL)).body();
    const payload = {
      data: `data:image/png;base64,${bytes.toString("base64")}`,
      width: source.image.width,
      height: source.image.height,
      description: source.image.description,
      masked: source.image.masked,
    };
    const operations = await Promise.all([
      call(
        request,
        other.token,
        `runs/${source.run.id}/evidence`,
        "POST",
        payload,
      ),
      call(request, other.token, `evidence/${source.image.id}`, "DELETE"),
    ]);
    expect(operations[1].ok()).toBe(true);
    expect([200, 409]).toContain(operations[0].status());
    expect(
      (
        await call(
          request,
          other.token,
          `runs/${source.run.id}/evidence`,
          "POST",
          payload,
        )
      ).status(),
    ).toBe(409);
    expect(
      (
        await call(request, other.token, `evidence/${source.image.id}`)
      ).status(),
    ).toBe(410);
  } finally {
    await closeDb();
  }
});
