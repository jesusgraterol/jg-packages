# Delivery

Default stop: **development**. Ordered stops: **development → main**.

## development

Operator: agent.

Run the applicable [development checks](development.md), review and commit the task's source, integrate it into development and push. Verify that the live origin/development contains the task commit.

## main

Operator: agent.

Follow [releasing](releasing.md), including version selection and qualification when shipped package contents change. Open development → main and merge after its checks pass. Verify the published versions and exact release artifacts through that procedure, and verify [website deployment](deployment.md) for the merged source.

## Evidence and cleanup

Report live branch/HEAD, committed source, remote containment and the reached stop. For main, include verified package versions and the website deployment revision. Remove only this task's clean, integrated, inactive worktree, local/remote task branches and temporary folders; identify retained work and evidence explicitly.
