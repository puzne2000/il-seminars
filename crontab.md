# Local cron job

A cron job runs `scrape_and_sync.sh` twice a week to keep the remote Supabase database fresh with HUJI seminar data. HUJI's servers block requests from cloud IP ranges (including Supabase's edge function runtime), so the scrape must run from a local machine.

## The cron entry

```
0 20 * * 1,4 "/Users/guykindler/My Drive/python stuff/il-seminars/scrape_and_sync.sh" >> /tmp/il-seminars-sync.log 2>&1
```

| Part | Meaning |
|------|---------|
| `0 20` | At 8:00pm |
| `* * 1,4` | Every Monday (1) and Thursday (4) |
| `>> /tmp/il-seminars-sync.log 2>&1` | Append all output to a log file |

Monday and Thursday were chosen to keep data reasonably fresh throughout the week without over-scraping.

**Note:** cron only runs if the machine is awake at the scheduled time. If the machine is asleep, the job is skipped until the next scheduled time.

## View the log

```bash
cat /tmp/il-seminars-sync.log
```

## View the current crontab

```bash
crontab -l
```

## Disable the job

```bash
crontab -e   # opens editor — delete the line and save
```

Or to remove all cron jobs at once:

```bash
crontab -r
```

## Change the schedule

```bash
crontab -e   # opens editor — modify the time/day fields and save
```

Cron schedule format: `minute hour day-of-month month day-of-week`

Examples:
- `0 20 * * 1,4` — Mon & Thu at 8pm
- `0 8 * * *` — every day at 8am
- `0 20 * * 0` — every Sunday at 8pm
