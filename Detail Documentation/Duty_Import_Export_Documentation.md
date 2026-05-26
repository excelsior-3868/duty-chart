# Duty Chart Excel Import & Export Documentation

This document provides a detailed technical overview of the implementation for downloading duty templates and importing duties via Excel.

---

## 1. Architecture Overview

 The feature follows a standard Client-Server architecture using **React (Frontend)** and **Django REST Framework (Backend)**. 
- **Frontend**: Handles the user interface for selecting parameters and uploading files.
- **Backend**: Generates dynamic Excel files with embedded formulas and processes uploaded files with strict validation logic.
- **Processing Engine**: Uses `openpyxl` for Excel generation and `pandas` for high-performance data parsing.

---

## 2. Code Flow

### A. Template Download Flow
1. **Request**: UI sends `office_id`, `start_date`, `end_date`, and `schedule_ids`.
2. **Data Retrieval**: Backend fetches the Office and associated Schedules.
3. **Excel Creation**:
    - Creates a workbook with two sheets: `Duty Import Template` and `Reference - Office Users`.
    - Generates date ranges.
    - **Algorithm**: For each Schedule, and for each Date in the range, it appends **two rows** to the template.
    - **Dynamic Formulas**: Injects `VLOOKUP`/`INDEX+MATCH` formulas into the "Employee Name", "Phone", and "Position" columns. These formulas react in real-time when a user selects an Employee ID.
4. **Data Validation**: Adds Excel Data Validation (dropdowns) to the "Employee ID" column, sourcing values from the hidden Reference sheet.
5. **Response**: Returns a binary stream (`.xlsx`) to the browser.

### B. Duty Import Flow
1. **Request**: UI uploads an Excel file along with Metadata (Office, Chart Name, Dates, Select Shifts).
2. **Pre-Validation**: 
   - Backend checks if a Duty Chart with same Office and Date Range already exists and includes any of the overlapping shifts.
3. **Atomic Processing**: 
   - The entire process is wrapped in a **Database Transaction**. If any row fails validation, the entire import (and the new chart) is rolled back.
4. **File Parsing**: Backend reads the file into a Pandas DataFrame.
5. **Database Preparation**: Creates a new `DutyChart` entry.
6. **Collision Detection**: 
   - **Global**: Checks if the user is already assigned to that shift/date anywhere in the system.
   - **Internal**: Detects duplicate assignments within the Excel file itself.
7. **Execution**: If all validations for a row pass, a `Duty` record is created.
8. **Automated Completion**: 
   - The modal closes automatically.
   - The calendar switches to the correct office, selects the new chart, and jumps to the effective date.
9. **Error Reporting**: Returns a structured response with failure details if the transaction fails.

---

## 3. Validation Logic

The import process implements strict Multi-Layer Validation:

| Parameter | Validation Type | Logic |
| :--- | :--- | :--- |
| **Date** | Format | Must be a valid ISO or Excel date object. |
| **Date** | Range | Date must be between the Duty Chart's Start and End dates. |
| **Date** | Timeline | **Future Dates Only**: Reject any date earlier than the current local date. |
| **Office** | Integrity | The "Office" column in the row must exactly match the name of the assigned Office. |
| **Employee ID** | Existence | Must exist in the `User` table (Primary check via ID, fallback to Name/Username). |
| **Schedule** | Existence | The "Schedule" (Shift) name must exist in the system for that Office. |
| **Start/End Time**| Synchronization| The times in the Excel row must **exactly match** the times defined in the system for that specific Schedule name. |
| **User Collision**| **Global Collision**| Check `Duty.objects.filter(...)` to ensure user isn't working that shift anywhere else. |
| **User Collision**| **Self-Collision**| Detect if the same user/shift/date appears twice in the same Excel file. |
| **Chart Collision**| **Shift Overlap**| Prevents creating charts that cover overlapping shifts in the same date range/office. |

---

## 4. Code Logic Deep Dive

### A. Template Generation (Backend - openpyxl)

The generation logic ensures that for every day and every shift, two slots are provided. It uses a helper function `get_f` to generate dynamic Excel formulas that reference the `Reference - Office Users` sheet.

```python
# Duplication and Formula Logic
for sch in schedules:
    for i in range(days):
        duty_date = start_date + timedelta(days=i)
        # Multiplication factor: 2 rows per slot
        for _ in range(2):
            match_val = f"MATCH(B{row_idx}, 'Reference - Office Users'!$G$2:$G$1000, 0)"
            
            def get_f(col_idx):
                ref_col = f"'Reference - Office Users'!${chr(64+col_idx)}2:${chr(64+col_idx)}1000"
                return f'=IF(B{row_idx}<>"", IFERROR(INDEX({ref_col}, {match_val}), ""), "")'

            ws.append([
                duty_date.isoformat(),
                "",       # Employee ID (Dropdown)
                get_f(1), # Auto-populated Name
                get_f(3), # Auto-populated Phone
                # ... other metadata ...
            ])
            row_idx += 1
```

### B. Import Validation Logic (Backend - pandas)

The import logic uses a "Fail-Fast per Row" approach. It iterates through the DataFrame and performs a series of conditional checks before attempting database insertion.

```python
# Validation Implementation Snippet
for idx, row in df.iterrows():
    row_num = idx + 2
    
    # 1. Office Check
    if str(row.get("Office")).strip().lower() != office.name.lower():
        errors.append(f"Row {row_num}: Office mismatch.")
        continue

    # 2. Date Check (Future Only)
    if duty_date < datetime.date.today():
        errors.append(f"Row {row_num}: Past dates are not allowed.")
        continue

    # 3. Time Sync Validation
    excel_start = normalize_time_str(row.get("Start Time"))
    if excel_start != schedule.start_time.strftime("%H:%M"):
        errors.append(f"Row {row_num}: Time mismatch for shift '{sch_name}'.")
        continue

    # 4. Final Insertion
    Duty.objects.create(...)
```

---

## 5. Files Involved

### Backend (`/backend/duties/`)
- `views.py`: Contains `DutyChartImportTemplateView` (Generation) and `DutyChartImportView` (Processing).
- `models.py`: Defines `DutyChart`, `Duty`, `Schedule`.

### Frontend (`/frontend/src/`)
- `pages/DutyCalendar.tsx`: UI for viewing duties.
- `components/dutychart/ImportDutyModal.tsx`: File upload interface.

---

## 6. Database Tables Involved

| Table Name | Purpose |
| :--- | :--- |
| `duties_dutychart` | Stores metadata (Name, Office, Date Range). |
| `duties_duty` | Records individual employee assignments. |
| `users_user` | Employee source of truth. |

---

## 7. Implementation Highlights (Algorithm)

**Formula-Based Automation:**
The template is not just a flat file; it's a "Smart Template". By using `INDEX` and `MATCH` instead of static values, we reduce manual data entry errors and ensure that the "Employee Name" and "Phone Number" columns are always in sync with the database, even if edited offline (provided the ID is correct).
