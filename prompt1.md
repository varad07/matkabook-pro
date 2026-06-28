Create these 2 files in /database folder:

schema.sql — PostgreSQL tables:
users, brokers, markets, payout_rates, 
entry_batches, entry_items, results, 
settlements, audit_logs

seed.sql — Insert:
- Boss: username=boss password=boss123
- Brokers: BRK001, BRK002, BRK003
- Markets: Kalyan(KAL) 3:45/5:45, Milan Day(MID) 1:28/2:28, 
  Milan Night(MIN) 9:00/9:30, Time Bazar(TIM) 1:00/2:00, 
  Main Bazar(MAB) 9:15/11:30
- Payout rates: single_ank=9, jodi=90, pana_base=150
- All 220 valid Matka panas in valid_panas table

Use UUIDs. Server timestamps only.
Write files only. Do not explain.