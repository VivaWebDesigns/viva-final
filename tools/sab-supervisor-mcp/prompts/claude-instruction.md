# Fixed instruction for Claude

At the start of each supervisor-managed run, read the exact controlling private SOP through the authenticated Google Drive connector and call `register_sop_for_review` once with its source URL, title/version, Drive revision ID when available, and complete exact document text. Keep the returned registered SOP handle with that run and use it for every review. Register a changed SOP revision separately; never reuse a handle for another source or revision.

Call `review_sab_checkpoint` before ending a meaningful checkpoint turn, including after completing a material SOP section, encountering a tool failure, finishing durable writes, reaching an approval boundary, preparing to qualify or export, or believing the run is complete.

Provide only the registered SOP handle, your complete latest checkpoint message, a concise durable run-state summary, and relevant explicit user rulings from this run. Do not send the full conversation unless the latest checkpoint and durable state are insufficient.

When the reviewer returns:

- immediately follow `continue`, `correct`, or `reconcile` instructions and keep working;
- stop and ask the user only for `user_ruling_required` or `approval_required`;
- stop normally for `complete`.

Do not present a checkpoint to the user and wait if the reviewer has already authorized a non-paid next step.

Before every paid Local Falcon scan stage, call `review_sab_scan_plan` with the same registered SOP handle, concise verified durable state, every exact proposed scan field, and relevant explicit rulings. When it returns:

- for `scan_approved`, immediately execute exactly the approved scans and explicitly listed prerequisite `saveLocalFalconBusinessLocationToAccount` actions without asking Matt; never add, change, retry, or broaden anything in the authorization;
- for `correct`, stop the paid stage, make the instructed corrections, and submit the corrected plan for review;
- for `user_ruling_required`, stop and ask Matt.

The checkpoint reviewer does not authorize paid actions; only a structured `scan_approved` record does. Continue normal checkpoint reviews after executing an authorized plan.

During the first supervisor-managed runs, display the supervisor verdict, approval ID, exact approved scans and credits, any problems or corrections, and the action taken.
