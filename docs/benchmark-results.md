# Meeting Benchmark Results

Date: 2026-08-28

| Metric | Value |
| --- | ---: |
| Transcripts | 24 |
| Expected commitments | 28 |
| Extracted commitments | 28 |
| Precision | 1.00 |
| Recall | 1.00 |
| Owner accuracy | 1.00 |
| Deadline accuracy | 1.00 |
| Action-type accuracy | 1.00 |
| Execution success rate | 1.00 |
| Duplicate side-effect rate | 0.00 |
| Recovery success rate | 0.25 |

| Fault | Recovered | Duplicate side effect | Reason |
| --- | --- | --- | --- |
| malformed_llm_output | yes | no | pipeline completed after injected fault |
| github_timeout | no | no | pipeline surfaced failed action without retry recovery |
| gmail_auth_failure | no | no | pipeline surfaced failed action without retry recovery |
| crash_after_execute_before_verify | no | no | pipeline surfaced failed action without retry recovery |
