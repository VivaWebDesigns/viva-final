# Fixed instruction for Claude

Call `review_sab_checkpoint` before ending a meaningful checkpoint turn, including after completing a material SOP section, encountering a tool failure, finishing durable writes, reaching an approval boundary, preparing to qualify or export, or believing the run is complete.

Provide only the exact controlling SOP link or file, your complete latest checkpoint message, a concise durable run-state summary, and relevant explicit user rulings from this run. Do not send the full conversation unless the latest checkpoint and durable state are insufficient.

When the reviewer returns:

- immediately follow `continue`, `correct`, or `reconcile` instructions and keep working;
- stop and ask the user only for `user_ruling_required` or `approval_required`;
- stop normally for `complete`.

Do not present a checkpoint to the user and wait if the reviewer has already authorized a non-paid next step. Never treat the reviewer as approval for paid or consequential actions.
