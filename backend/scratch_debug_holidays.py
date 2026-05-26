import pandas as pd
import nepali_datetime
import sys

try:
    file_path = '../frontend/nepal_holidays_sorted.xlsx'
    df = pd.read_excel(file_path)
    print(f"Original Columns: {df.columns.tolist()}")
    
    df.columns = [str(c).strip().lower() for c in df.columns]
    col_map = {
        'date (bs)': 'date_bs',
        'holiday name': 'name',
        'days': 'days'
    }
    df = df.rename(columns=col_map)
    print(f"Mapped Columns: {df.columns.tolist()}")
    print(f"Total Rows: {len(df)}")
    
    preview_data = []
    skipped = []
    
    for i, row in df.iterrows():
        try:
            bs_val = str(row['date_bs']).strip()
            if '/' in bs_val:
                parts = bs_val.split('/')
                p1, p2, p3 = map(int, parts)
                bs_date = nepali_datetime.date(p1, p2, p3)
                
                days = 1
                if 'days' in df.columns and pd.notnull(row['days']):
                    days = int(row['days'])
                
                for d in range(days):
                    curr = bs_date + nepali_datetime.timedelta(days=d)
                    preview_data.append(str(curr.to_datetime_date()))
            else:
                skipped.append(f"Row {i+2}: No '/' in {bs_val}")
        except Exception as e:
            skipped.append(f"Row {i+2}: {str(e)}")
            
    print(f"Successfully parsed: {len(preview_data)} dates")
    print(f"Skipped: {len(skipped)}")
    if skipped:
        print(f"First 5 skipped reasons: {skipped[:5]}")

except Exception as e:
    print(f"Fatal error: {e}")
