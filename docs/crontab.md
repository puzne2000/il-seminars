# Local cron job

A cron job runs `update-seminars.sh` every day to refresh the seminar data and deploy it (see
`docs/deployment.md`). Some university sites (HUJI in particular) block cloud IP ranges, so the scrape
runs from this machine.

## The cron entry

```
30 6 * * * echo "--- $(date) ---" >> /tmp/il-seminars-sync.log 2>&1 && "/Users/guykindler/My Drive/python stuff/il-seminars/update-seminars.sh" >> /tmp/il-seminars-sync.log 2>&1
```

| Part | Meaning |
|------|---------|
| `30 6 * * *` | Every day at 06:30 local time |
| `echo "--- $(date) ---"` | Writes a timestamp line to the log before each run |
| `>> /tmp/il-seminars-sync.log 2>&1` | Append all output to a log file |

**Note:** cron only runs if the machine is awake at the scheduled time. If the machine is asleep, the job is
skipped until the next scheduled time.

Cron starts with a minimal `PATH` (`/usr/bin:/bin`). `update-seminars.sh` adds `/opt/homebrew/bin` (where
`node`/`npx` are installed) itself; before that fix (2026-11-25), every run from 2026-10-24 failed with
`npx: command not found`.

To test the job the way cron runs it:

```bash
env -i HOME="$HOME" USER="$USER" LOGNAME="$USER" SHELL=/bin/sh PATH=/usr/bin:/bin \
  /bin/sh -c '"/Users/guykindler/My Drive/python stuff/il-seminars/update-seminars.sh"'
```

## View the log

```bash
tail -50 /tmp/il-seminars-sync.log
```

## View the current crontab

```bash
crontab -l
```

## Change or disable the schedule

```bash
crontab -e   # opens editor — edit the time/day fields, or delete the line, and save
```

Cron schedule format: `minute hour day-of-month month day-of-week`

Examples:
- `30 6 * * *` — every day at 06:30
- `0 20 * * 1,4` — Mon & Thu at 8pm
- `0 20 * * 0` — every Sunday at 8pm
