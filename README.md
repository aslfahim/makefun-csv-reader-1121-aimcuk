# makefun-csv-reader-1121-aimcuk

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/aslfahim/makefun-csv-reader-1121-aimcuk/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/aslfahim/makefun-csv-reader-1121-aimcuk/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast line-based CSV reader that returns exactly csv-reader 1.0.0's answers: the text is split on LF once, each line is processed with a tight per-line loop (a plain line is one native split), and quoted fields that stay open are reassembled by joining continuation lines with LF. It reproduces every broken-row quirk — stray CR, doubled quotes, CRLF and lone CR inside quotes read as LF, quote junk, unterminated quotes, and short/long row padding and cutting — with errors in the order met.

## Run it

```sh
node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
