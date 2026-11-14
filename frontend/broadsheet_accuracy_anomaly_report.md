# Accuracy and anomaly audit: B.Ed Educational Administration and Planning broadsheets

## Scope

Five workbooks were checked: 2021/2022 Contact 2 through 2025/2026 Contact 6. The audit covered 146 candidates per workbook, candidate continuity, score/grade agreement, credit and quality-point arithmetic, GPA/CGPA arithmetic, remarks, summary counts, missing/NR results, and carry-forward consistency between consecutive exports.

## Executive finding

The individual score calculations inside each workbook are internally consistent. No duplicate matric numbers, missing candidates, changed names, broken serial numbers, invalid grade letters, out-of-range scores, or formula errors were found. The main accuracy risk is version inconsistency in historical cumulative totals, plus unresolved NR results.

## Material anomalies

### 1. Historical totals change between exports

| Transition | Candidates affected | Registered-unit changes | Earned-unit changes | Quality-point changes | CGPA changes |
|---|---:|---:|---:|---:|---:|
| 2021/2022 → 2022/2023 | 0 | 0 | 0 | 0 | 0 |
| 2022/2023 → 2023/2024 | 0 | 0 | 0 | 0 | 0 |
| 2023/2024 → 2024/2025 | 105 | 0 | 89 | 105 | 105 |
| 2024/2025 → 2025/2026 | 58 | 0 | 29 | 58 | 58 |

For the 2023/2024 → 2024/2025 transition, 100 of 105 quality-point changes increased and 5 decreased; changes range from −4 to +28 points. CGPA changes range from −0.05 to +0.30. For 2024/2025 → 2025/2026, 55 of 58 quality-point changes increased and 3 decreased; changes range from −8 to +28 points. CGPA changes range from −0.07 to +0.26.

Examples:

- CCE/EDU/MEAP2/22/125: 2023/2024 cumulative was 87 registered, 75 earned, 245 points, CGPA 2.82; the next export's previous totals are 87, 77, 255, 2.93.
- CCE/EDU/MEAP2/22/151: 2024/2025 cumulative was 99 registered, 99 earned, 327 points, CGPA 3.30; the next export's previous totals are 99, 99, 343, 3.46.
- CCE/EDU/MEAP2/22/034: 2024/2025 cumulative was 109 registered, 99 earned, 374 points, CGPA 3.43; the next export's previous totals are 109, 99, 366, 3.36.

The full row-level comparison is in **broadsheet_carry_forward_gaps.csv**.

### 2. NR result gaps

- 2024/2025 contains 56 current-course NR entries affecting 46 candidates: EDU362 16, EDU411 14, EAP412 10, EDU461 9, and EAP312 7. The summary correctly reports 46 pending candidates; the difference between 46 candidates and 56 entries is because some candidates have more than one NR.
- 2025/2026 still displays 17 NR values in the carryover block for 16 candidates: ECO212 9, EDU331 3, POL212 3, and EDU321 2. These are excluded from the current-contact GPA denominator and treated as unresolved carryovers, which is internally consistent with the workbook's calculation method, but the numeric results remain absent.

The affected candidates and courses are listed in **broadsheet_nr_gaps.csv**.

## Likely cause of the gaps

The carry-forward discrepancy is most consistent with historical records being recalculated or corrected after an earlier workbook was exported, while the earlier export was not regenerated. Evidence: registered units never change, but earned units, quality points, and CGPA do; most changes are increases, but a few decreases also occur. This pattern points to amended grades/result statuses or a grade-replacement/recalculation rule, not missing candidates or arithmetic failure.

This cause is an evidence-based inference. It cannot be proved from the five exports alone because they contain no audit log, amendment date, approval reference, or source-system version identifier.

The NR gaps originate from missing numeric results in the named courses. The exports show the gaps and affected records, but do not contain lecturer-submission or approval metadata needed to identify the responsible source or workflow stage.

## Checks that passed

- Exactly 146 unique candidates appear in every workbook; candidate names and matric numbers are unchanged across all five sessions.
- All score suffixes match the stated grading bands (A–F), and no numeric score is outside 0–100.
- Current registered units, earned units, quality points, GPA, cumulative totals, and CGPA recalculate correctly under the workbook's treatment of current NR and carryover NR.
- Carryover and pending remarks agree with the course cells.
- Candidate-performance and course-performance summaries reconcile with the detailed rows.
- No Excel formulas or formula-error cells are present; all totals are stored values.

## Recommended action

1. Treat the latest export as provisional until the 105 and 58 carry-forward changes are matched to approved result amendments.
2. For each row in the carry-forward CSV, identify the authoritative value and record an amendment reference, date, and approver.
3. Resolve the 17 NR carryover values still visible in 2025/2026 and confirm whether all 56 2024/2025 pending entries were formally cleared.
4. Add an export version/date and immutable prior-contact snapshot so a later export cannot silently change historical totals.
5. Generate totals from formulas or a controlled result system instead of storing unexplained hard-coded cumulative values.

## Audit limitations

This was a workbook-level consistency audit. It did not verify scores against scripts, lecturer mark sheets, senate/board approvals, or the source database. Source files were read only and were not modified.
