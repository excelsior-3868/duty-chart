import pandas as pd
import sys

file_path = "/Users/subin/Github/duty-chart/frontend/nepal_holidays_sorted.xlsx"
try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("First 2 rows:")
    print(df.head(2).to_dict('records'))
except Exception as e:
    print(f"Error: {e}")
