<!-- AUTO-GENERATED:backlink START -->
[← Back](test_editor.md)
<!-- AUTO-GENERATED:backlink END -->
#exam
#card
1) CL (2 columns) – Type the correct JOIN types into the table.

| |   |
|---|---|
| Only rows with a match in both tables | %%INNER JOIN%% |
| All rows on the left + matching on the right (otherwise NULL) | %%LEFT JOIN%% |
| All rows on the right + matching on the left (otherwise NULL) | %%RIGHT JOIN%% |
| All rows from both sides, matches combined, otherwise NULL | %%FULL OUTER JOIN%% |

#
---
#card
2) CL (3 columns) – Type the correct SQL keyword.

|   |   |   |
|---|---|---|
| Filter rows (before GROUP BY) | %%WHERE%% | SELECT * FROM users WHERE age > 18; |
| Group | %%GROUP BY%% | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Filter groups (after GROUP BY) | %%HAVING%% | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sort | %%ORDER BY%% | SELECT * FROM users ORDER BY created_at DESC; |
| Limit | %%LIMIT%% | SELECT * FROM users ORDER BY id LIMIT 10; |

#
---
#card
3) CD (2 columns) – Drag the correct JOIN into the right cell (token bank).

|   |   |
|---|---|
| Only rows with a match in both tables | `INNER JOIN` |
| All rows on the left + matching on the right (otherwise NULL) | `LEFT JOIN` |
| All rows on the right + matching on the left (otherwise NULL) | `RIGHT JOIN` |
| All rows from both sides, matches combined, otherwise NULL | `FULL OUTER JOIN` |

#
---
#card
4) CD (3 columns) – Drag the appropriate keyword into the middle column.

|   |   |   |
|---|---|---|
| Filter rows (before GROUP BY) | `WHERE` | SELECT * FROM users WHERE age > 18; |
| Group | `GROUP BY` | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Filter groups (after GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sort | `ORDER BY` | SELECT * FROM users ORDER BY created_at DESC; |
| Limit | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT 10; |

#
---
#card
5) CLD (2 columns) – Drag keyword + type the missing values.

|   |   |
|---|---|
| Filter rows | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Sort | `ORDER BY` SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Limit | `LIMIT` SELECT * FROM users ORDER BY id LIMIT %%10%%; |
| Group | `GROUP BY` SELECT country, COUNT(*) FROM users GROUP BY %%country%%; |

#
---
#card
6) CLD (3 columns) – Drag keyword + type the missing values in the example.

|   |   |   |
|---|---|---|
| Filter rows | `WHERE` | SELECT * FROM users WHERE age > %%18%%; |
| Filter groups (after GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > %%10%%; |
| Sort | `ORDER BY` | SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Limit | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT %%10%%; |
#
#examend
