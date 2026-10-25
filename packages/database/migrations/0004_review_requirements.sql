-- A previous scanner version or an unknown/contextual rule never weakens human review requirements.
UPDATE findings SET verification_requirement='human-review'
WHERE outcome='incomplete' OR rule NOT IN ('button-name','link-name','label','aria-required-attr','aria-valid-attr','aria-valid-attr-value','duplicate-id-aria');
