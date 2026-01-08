<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
#exam
1) CL (2 Spalten) – Tippe die passenden JOIN-Typen in die Tabelle.

| |   |
|---|---|
| Nur Zeilen mit Match in beiden Tabellen | %%INNER JOIN%% |
| Alle Zeilen links + passende rechts (sonst NULL) | %%LEFT JOIN%% |
| Alle Zeilen rechts + passende links (sonst NULL) | %%RIGHT JOIN%% |
| Alle Zeilen beider Seiten, Matches zusammen, sonst NULL | %%FULL OUTER JOIN%% |

---
2) CL (3 Spalten) – Tippe das richtige SQL-Keyword.

|   |   |   |
|---|---|---|
| Zeilen filtern (vor GROUP BY) | %%WHERE%% | SELECT * FROM users WHERE age > 18; |
| Gruppieren | %%GROUP BY%% | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Gruppen filtern (nach GROUP BY) | %%HAVING%% | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sortieren | %%ORDER BY%% | SELECT * FROM users ORDER BY created_at DESC; |
| Begrenzen | %%LIMIT%% | SELECT * FROM users ORDER BY id LIMIT 10; |

---
3) CD (2 Spalten) – Ziehe den richtigen JOIN in die rechte Zelle (Token-Bank).

|   |   |
|---|---|
| Nur Zeilen mit Match in beiden Tabellen | `INNER JOIN` |
| Alle Zeilen links + passende rechts (sonst NULL) | `LEFT JOIN` |
| Alle Zeilen rechts + passende links (sonst NULL) | `RIGHT JOIN` |
| Alle Zeilen beider Seiten, Matches zusammen, sonst NULL | `FULL OUTER JOIN` |

---
4) CD (3 Spalten) – Ziehe das passende Keyword in die mittlere Spalte.

|   |   |   |
|---|---|---|
| Zeilen filtern (vor GROUP BY) | `WHERE` | SELECT * FROM users WHERE age > 18; |
| Gruppieren | `GROUP BY` | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Gruppen filtern (nach GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sortieren | `ORDER BY` | SELECT * FROM users ORDER BY created_at DESC; |
| Begrenzen | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT 10; |

---
5) CLD (2 Spalten) – Drag Keyword + tippe die fehlenden Werte.

|   |   |
|---|---|
| Zeilen filtern | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Sortieren | `ORDER BY` SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Begrenzen | `LIMIT` SELECT * FROM users ORDER BY id LIMIT %%10%%; |
| Gruppieren | `GROUP BY` SELECT country, COUNT(*) FROM users GROUP BY %%country%%; |

---
6) CLD (3 Spalten) – Drag Keyword + tippe die fehlenden Werte im Beispiel.

|   |   |   |
|---|---|---|
| Zeilen filtern | `WHERE` | SELECT * FROM users WHERE age > %%18%%; |
| Gruppen filtern (nach GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > %%10%%; |
| Sortieren | `ORDER BY` | SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Begrenzen | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT %%10%%; |
#examend
