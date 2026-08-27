# Commitment Planning

YoMeets maps meeting commitments to concrete execution actions before any external side effect happens.

Current deterministic mapping:

| Commitment type | Planned action | Approval |
| --- | --- | --- |
| `investigation` | `github.create_issue` | required |
| `schedule_change` | `calendar.update_event` | required |
| `follow_up_message` | `gmail.create_draft` | required |
| `decision_record` | `memory.record_decision` | not required |

This is intentionally smaller than a general planner. The goal is to make transcript commitments reviewable and executable in the tools where engineering work continues.
