---
Cover: '[[TexV0.1main-01.png]]'
Section: Blobbite
Rank: Develop
Projekt: FMDFlashcard
Task: docs
tags:
- TexV0.1main
- Blobbite
- Develop
- FMDFlashcard
- docs
link1: '[[TexV0.1main]]'
---

Markdown-Scan – Root: /mnt/T7-1TB/workspace/Blobbite/Develop/FMDFlashcard/docs/FMDFlashcard
Erzeugt: 2025-12-16T22:05:32
Einstellungen: content=full, snippet_chars=800, toc_depth=3, types=.tex

=== Dateien ===

📁 .
  📝 name.tex
     Pfad: 📝 name.tex
     Größe: 3.25 KB (3326 B)
     Geändert: 2025-12-16T20:56:12
     Überschriften: 0, Zeilen: 124, Wörter: 291, Zeichen: 3316
     Inhalt (Auszug): % !TeX program = pdflatex \documentclass[11pt,a4paper]{article}
     Inhalt (voll):
       % !TeX program = pdflatex
       \documentclass[11pt,a4paper]{article}
       
       % zentrale Einstellungen / Pakete
       \input{preamble}
       
       % ------------------ Projektdaten ---------------------------------
       \newcommand{\projektname}{FMD Flashcard}
       \newcommand{\dokumenttyp}{Projekt-Dokumentation}
       \newcommand{\dokumenttitel}{Vault-basierte Lern-App}
       \newcommand{\version}{0.1.0}
       \newcommand{\status}{Entwurf}
       \newcommand{\build}{Commit: \codeinline{<hash>} \quad Branch: \codeinline{main}}
       \newcommand{\repo}{\url{https://<dein-repo-link>}}
       \newcommand{\autorname}{Marcel Tenhaft}
       \newcommand{\kontakt}{\codeinline{<mail>} / \codeinline{<discord/github>}}
       \newcommand{\abgabedatum}{Dezember 2025}
       
       % PDF-Metadaten (optional)
       \hypersetup{
         pdftitle={\projektname\ - \dokumenttyp},
         pdfauthor={\autorname}
       }
       
       \begin{document}
       
       % ======================= TITELSEITEN ==============================
       \pagenumbering{Roman}
       \thispagestyle{empty}
       
       \begin{titlepage}
         \centering
         {\Large \dokumenttyp \par}
         \vspace{1.2cm}
       
         {\bfseries\LARGE \projektname \par}
         \vspace{0.3cm}
         {\Large \dokumenttitel \par}
       
         \vspace{1.8cm}
       
         \begin{tabular}{@{}ll@{}}
           Version: & \version \\
           Status:  & \status \\
           Datum:   & \abgabedatum \\
           Autor:   & \autorname \\
           Repository: & \repo \\
           Build: & \build \\
           Kontakt: & \kontakt \\
         \end{tabular}
       
         \vfill
         \small
         Dieses Dokument beschreibt Anforderungen, Architektur, Implementierung und Betrieb des Projekts \projektname.
       \end{titlepage}
       
       % ======================= DOKUMENTKONTROLLE ========================
       \section*{Änderungshistorie}
       \addcontentsline{toc}{section}{Änderungshistorie}
       
       \begin{tabularx}{\textwidth}{@{}l l l X@{}}
       \textbf{Version} & \textbf{Datum} & \textbf{Autor} & \textbf{Änderung} \\
       \hline
       0.1.0 & \abgabedatum & \autorname & Initiale Projektstruktur, Präambel, Kapitel-Imports \\
       \end{tabularx}
       
       \newpage
       
       % ======================= VERZEICHNISSE ============================
       \tableofcontents
       \newpage
       
       \renewcommand{\listfigurename}{Abbildungen}
       \renewcommand{\listtablename}{Tabellen}
       
       \begingroup
       \setcounter{tocdepth}{0}
       \listoffigures
       \bigskip
       \listoftables
       %\listofcommands
       \endgroup
       
       \newpage
       
       % ======================= ABKÜRZUNGEN ==============================
       \section*{Abkürzungsverzeichnis}
       \addcontentsline{toc}{section}{Abkürzungsverzeichnis}
       
       \begin{tabularx}{\textwidth}{@{}llX@{}}
       \textbf{Abk.} & \textbf{Deutsch} & \textbf{Englisch / Kommentar} \\
       \hline
       A/B-Test & Vergleichstest & Split-Run-Test zweier Varianten \\
       IT       & Informationstechnologie & Information Technology \\
       \end{tabularx}
       
       \newpage
       
       % ======================= HAUPTTEIL ================================
       \pagenumbering{arabic}
       \setcounter{page}{1}
       
       % Tipp: In deinen Kapiteldateien kannst du Code so setzen:
       % \begin{codeblock}[title=Terminal]
       % cargo tauri dev
       % \end{codeblock}
       
       \input{FMD/chapters/einleitung/100}
       \input{FMD/chapters/hauptteil/200}
       \input{FMD/chapters/schluss/300}
       
       % ======================= LITERATUR ================================
       \clearpage
       \printbibliography[heading=bibintoc, title={Literaturverzeichnis}]
       \clearpage
       
       % ======================= ANHANG ===================================
       \section*{Verzeichnis der Anhänge}
       \addcontentsline{toc}{section}{Verzeichnis der Anhänge}
       
       \appendix
       \section{Beispielanhänge}
       
       \end{document}

  📝 preamble.tex
     Pfad: 📝 preamble.tex
     Größe: 3.89 KB (3987 B)
     Geändert: 2025-12-16T20:56:12
     Titel: 1
     Überschriften: 2, Zeilen: 146, Wörter: 375, Zeichen: 3977
     Inhalt (Auszug): % ===================== Sprache & Encoding ===================== \usepackage[ngerman]{babel} \usepackage[T1]{fontenc} \usepackage[utf8]{inputenc} % für pdfLaTeX \usepackage{csquotes}
     Inhalt (voll):
       % ===================== Sprache & Encoding =====================
       \usepackage[ngerman]{babel}
       \usepackage[T1]{fontenc}
       \usepackage[utf8]{inputenc} % für pdfLaTeX
       \usepackage{csquotes}
       
       % ===================== Seitenlayout =====================
       \usepackage{geometry}
       \geometry{top=2cm, bottom=2cm, left=2cm, right=2cm}
       
       % 1,5 Zeilenabstand
       \usepackage{setspace}
       \onehalfspacing
       
       % Blocksatz-Feintypografie
       \usepackage{microtype}
       
       % ===================== Schrift (modern) =====================
       \usepackage[sfdefault]{FiraSans} % modern, gut lesbar
       \usepackage{FiraMono}           % terminal-artig
       \renewcommand{\familydefault}{\sfdefault}
       
       % ===================== Überschriften exakt 12 pt =====================
       \usepackage{titlesec}
       \titleformat{\section}{\bfseries\fontsize{12pt}{14pt}\selectfont}{\thesection}{1em}{}
       \titleformat{\subsection}{\bfseries\fontsize{12pt}{14pt}\selectfont}{\thesubsection}{1em}{}
       \titleformat{\subsubsection}{\bfseries\fontsize{12pt}{14pt}\selectfont}{\thesubsubsection}{1em}{}
       
       % Max. 3 Ebenen nummerieren & im ToC zeigen
       \setcounter{secnumdepth}{3}
       \setcounter{tocdepth}{3}
       
       % Absätze: 6 pt Abstand, kein Erstzeileneinzug
       \setlength{\parskip}{6pt}
       \setlength{\parindent}{0pt}
       
       % Fußnoten = 10 pt
       \makeatletter
       \renewcommand\footnotesize{\@setfontsize\footnotesize{10pt}{12pt}}
       \makeatother
       
       % ===================== Kopf-/Fußzeile =====================
       \usepackage{fancyhdr}
       \pagestyle{fancy}
       \fancyhf{}
       \fancyfoot[C]{\thepage}
       \renewcommand{\headrulewidth}{0pt}
       
       % ===================== Grafiken, Tabellen =====================
       \usepackage{graphicx}
       \usepackage{booktabs}
       \usepackage{array}
       \usepackage{float}
       \usepackage{threeparttable}
       \usepackage{tabularx}
       
       % Farben für Tabellen-Zeilen
       \usepackage[table]{xcolor} % \rowcolor in Tabellen
       
       % Moderne Tabellen-Box (wie Codeblöcke)
       \usepackage[most]{tcolorbox}
       \usepackage{tabularray}
       \UseTblrLibrary{booktabs}
       \tcbuselibrary{listings,breakable}
       \newtcolorbox{tableblock}[1][]{
         enhanced,
         breakable,
         colback=black!3,
         colframe=black!12,
         boxrule=0.4pt,
         arc=2mm,
         left=6pt,right=6pt,top=6pt,bottom=6pt,
         #1
       }
       \renewcommand{\arraystretch}{1.15}
       \setlength{\tabcolsep}{6pt}
       
       % ===================== Code-Blöcke (hellgrau + Terminal-Look) =====================
       \usepackage{listings}
       
       \lstdefinestyle{terminal}{
         basicstyle=\ttfamily\small,
         columns=fullflexible,
         breaklines=true,
         keepspaces=true,
         showstringspaces=false,
         tabsize=2
       }
       
       % Umgebung: \begin{codeblock}...\end{codeblock}
       \newtcblisting{codeblock}[1][]{
         listing only,
         breakable,
         colback=black!3,
         colframe=black!12,
         boxrule=0.4pt,
         arc=2mm,
         left=6pt,right=6pt,top=6pt,bottom=6pt,
         listing options={style=terminal},
         #1
       }
       
       % Inline-Code (optional): \codeinline{...}
       \usepackage{xparse}
       \NewDocumentCommand{\codeinline}{m}{\texttt{#1}}
       
       % (optional) sauberere Captions (auch für \caption*)
       \usepackage[font=small,labelfont=bf]{caption}
       % ===================== Hyperlinks (spät laden) =====================
       \usepackage[hidelinks]{hyperref}
       \usepackage{url}
       
       % ===================== Eigene Verzeichnisse / Registerzuordnung =====================
       \usepackage{tocloft}
       \usepackage{etoolbox}
       
       % --- Registerzuordnung (Nier-Berlin) -----------------------------
       \newlistof{regentry}{rgt}{Registerzuordnung (Nier\,-\,Berlin)}
       \newcommand{\listofregister}{\listof{regentry}{Registerzuordnung (Nier\,-\,Berlin)}}
       \newcounter{regtab}
       \NewDocumentCommand{\RegisterCategory}{O{} m}{%
         \begingroup
         \def\entry{#2}%
         \ifstrempty{#1}{%
           \stepcounter{regtab}%
           \addcontentsline{rgt}{regentry}{Tab \theregtab\quad \entry}%
         }{%
           \addcontentsline{rgt}{regentry}{Tab #1\quad \entry}%
         }%
         \endgroup
       }
       
       % ===================== Literatur: biblatex-apa =====================
       \usepackage[
         style=apa,
         backend=biber,
         sorting=nyt,
         giveninits=true,
         maxcitenames=2,
         maxbibnames=20,
         doi=true,
         url=true,
         isbn=true
       ]{biblatex}
       \DeclareLanguageMapping{ngerman}{ngerman-apa}
       \addbibresource{references.bib}


📁 FMD/chapters/einleitung
  📝 100.tex
     Pfad: 📁 FMD / 📁 chapters / 📁 einleitung / 📝 100.tex
     Größe: 2.90 KB (2969 B)
     Geändert: 2025-12-16T20:56:12
     Überschriften: 0, Zeilen: 39, Wörter: 337, Zeichen: 2953
     Inhalt (Auszug): \begin{figure}[H] \centering \includegraphics[width=0.35\textwidth]{FMD/image/logo.png} \caption{Projektlogo \projektname\ (logo).\cite{Eigendarstellung}} \label{fig:zielsetzung-visualisierung} \end{figure}
     Inhalt (voll):
       
       
       \begin{figure}[H]
           \centering
           \includegraphics[width=0.35\textwidth]{FMD/image/logo.png}
           \caption{Projektlogo \projektname\ (logo).\cite{Eigendarstellung}}
           \label{fig:zielsetzung-visualisierung}
       \end{figure}
       
       \section{Einleitung}
       % Was:
       Diese Arbeit dokumentiert die Konzeption und Umsetzung des Projekts \projektname, einer Vault-basierten Lern- und Flashcard-Anwendung. Der Schwerpunkt liegt auf der technischen Projektdokumentation (Architektur, Implementierung, Build-/Run-Prozess, Tests und Betrieb), sodass das System nachvollziehbar reproduziert, bewertet und weiterentwickelt werden kann.
       
       % Warum:
       Die Dokumentation dient als zentrale Referenz für Entscheidungen und Vorgehensweisen im Projektverlauf. Sie reduziert Einarbeitungszeit, erleichtert Reviews und schafft eine belastbare Grundlage für Wartung, Erweiterungen und spätere Refactorings.
       
       % Ergebnis:
       Als Ergebnis entsteht eine strukturierte Projektbeschreibung mit klaren Anforderungen, einem konsistenten Architekturmodell, einem nachvollziehbaren Entwicklungsprozess sowie konkreten Anleitungen für Setup, Nutzung und Betrieb.
       
       \subsection{Motivation}
       Digitale Lerninhalte verteilen sich häufig über Notizen, PDFs, Karteikarten-Apps und verschiedene Geräte. Dadurch entstehen Medienbrüche, redundante Inhalte und ein hoher Pflegeaufwand. Insbesondere beim langfristigen Lernen ist es hilfreich, wenn Wissen strukturiert, versionierbar und wiederverwendbar vorliegt.
       
       Das Projekt adressiert dieses Problem durch eine Vault-basierte Organisation der Inhalte (analog zu wissensbasierten Notizsystemen) und verbindet diese mit einer Flashcard-Logik. Ziel ist eine Lösung, die Inhalte konsistent verwaltet, den Lernfortschritt abbildet und gleichzeitig eine einfache Erweiterbarkeit für spätere Funktionen (z.\,B. Synchronisation, Import/Export, Statistiken) ermöglicht.
       
       \subsection{Ziel und Fragestellung}
       Ziel des Projekts ist die Entwicklung eines lauffähigen Prototyps einer Lernanwendung, die Lerninhalte in einer klar definierten Datenstruktur (Vault) verwaltet und daraus Flashcards für wiederholtes Lernen ableitet.
       
       Die leitende Fragestellung lautet:
       \enquote{Wie kann eine Vault-basierte Lernanwendung so konzipiert und implementiert werden, dass Inhalte reproduzierbar verwaltet, effizient gelernt und technisch wartbar weiterentwickelt werden können?}
       
       \subsection{Beitrag dieses Papers}
       Dieses Dokument liefert die für das Projekt wesentlichen Artefakte und Entscheidungen in strukturierter Form:
       \begin{itemize}
         \item eine nachvollziehbare Beschreibung der Anforderungen und Zielkriterien,
         \item eine konzeptionelle Architektur (Datenmodell, Komponenten, Schnittstellen),
         \item eine strukturierte Darstellung der Entwicklungsphasen von den Grundlagen bis zum Prototyp,
         \item konkrete Hinweise zu Setup, Build/Run, Konfiguration und Projektstruktur,
         \item eine Zusammenfassung zentraler Entscheidungen, Risiken sowie offener Punkte.
       \end{itemize}


📁 FMD/chapters/hauptteil
  📝 200.tex
     Pfad: 📁 FMD / 📁 chapters / 📁 hauptteil / 📝 200.tex
     Größe: 6.66 KB (6822 B)
     Geändert: 2025-12-16T20:56:12
     Titel: Arch Linux (Details + vollständiges Setup: siehe Anhang A)
     Überschriften: 10, Zeilen: 146, Wörter: 837, Zeichen: 6771
     Inhalt (Auszug): \section{Installation \& Entwicklungsumgebung} Dieses Kapitel beschreibt die notwendigen Voraussetzungen sowie die empfohlene Toolchain, um \projektname lokal zu bauen und auszuführen. Der Schwerpunkt liegt auf einer reproduzierbaren Entwicklungsumgebung und einem klaren Setup-Prozess. Da zentrale Installations- und Diagnoseaufgaben über Skripte automatisiert werden, wird \textbf{Python} als erste Voraussetzung behandelt.
     Inhalt (voll):
       \section{Installation \& Entwicklungsumgebung}
       Dieses Kapitel beschreibt die notwendigen Voraussetzungen sowie die empfohlene Toolchain, um \projektname lokal zu bauen und auszuführen. Der Schwerpunkt liegt auf einer reproduzierbaren Entwicklungsumgebung und einem klaren Setup-Prozess. Da zentrale Installations- und Diagnoseaufgaben über Skripte automatisiert werden, wird \textbf{Python} als erste Voraussetzung behandelt.
       
       \subsection{Voraussetzung: Python}
       Python ist eine weit verbreitete, plattformübergreifende Programmiersprache, die häufig für Automatisierung, Systemadministration und Tooling eingesetzt wird. In diesem Projekt wird Python primär als \textbf{administrative Unterstützung} genutzt: Installations- und Setup-Schritte werden über Skripte standardisiert, und das Checkup-/Diagnose-Skript verwendet Python, um Systemzustand, Abhängigkeiten und Toolchain konsistent zu prüfen.
       
       \textbf{Warum Python zuerst?}
       \begin{itemize}
         \item Installationsskripte und Checks können damit auf \textbf{Windows, Linux und macOS} einheitlich ausgeführt werden.
         \item Python eignet sich für robuste Systemabfragen (z.\,B. Pfade, Versionen, verfügbare Tools) und reduziert manuelle Fehler.
         \item Das Projekt nutzt Python nicht als Laufzeitabhängigkeit der Anwendung selbst, sondern als \textbf{Tooling-Schicht} rund um Setup und Wartung.
       \end{itemize}
       
       \textbf{Hinweis zur Vorinstallation:}
       Auf vielen Linux-Distributionen ist \codeinline{python3} in typischen Desktop-Installationen bereits vorhanden (z.\,B. Ubuntu, Fedora Workstation, openSUSE Leap).
       Das ist jedoch nicht garantiert: Bei Minimal-Images oder sehr schlanken Installationen kann Python fehlen (z.\,B. bei einer reinen Arch-\codeinline{base}-Installation).
       Auf macOS wird Python nicht zuverlässig mitgeliefert und sollte daher explizit installiert werden.
       Für eine reproduzierbare Umgebung wird in jedem Fall empfohlen, die verwendete Python-Version zu prüfen und zu dokumentieren.
       
       \textbf{Beispiel Installationsbefehle:}
       
       \begin{codeblock}[title=Python installieren (Beispiele)]
       # Arch Linux (Details + vollständiges Setup: siehe Anhang A)
       sudo pacman -S python python-pip
       
       # Ubuntu/Debian
       sudo apt update
       sudo apt install python3 python3-pip
       
       # macOS (Homebrew)
       brew install python
       
       # Windows (Winget)
       winget install -e --id Python.Python.3
       \end{codeblock}
       
       \subsubsection{Prüfen der Installation}
       Nach der Installation sollte die Python-Version überprüft werden. Je nach System ist Python entweder über \codeinline{python} oder \codeinline{python3} erreichbar.
       
       \begin{codeblock}[title=Python-Version prüfen]
       python3 --version
       # alternativ (falls passend):
       python --version
       \end{codeblock}
       
       \begin{codeblock}[title=Quickstart (Beispiel)]
       git clone <REPO-URL>
       cd <PROJEKT-ORDNER>
       
       # optional: Health-Check / Doctor
       ./control.sh doctor
       
       # Dependencies installieren / Build vorbereiten
       ./control.sh install
       
       # Projekt starten (Dev)
       ./control.sh run
       \end{codeblock}
       
       \textit{Hinweis:} Falls das Projekt ohne Control-Skript betrieben werden soll, sind die äquivalenten Build-/Run-Befehle im Abschnitt \enquote{Setup-Schritte} dokumentiert.
       
       \subsection{Voraussetzungen}
       Für die Entwicklung werden folgende Rahmenbedingungen empfohlen:
       \begin{itemize}
         \item \textbf{Betriebssystem:} Linux (primär getestet unter Arch Linux), Windows/macOS optional.
         \item \textbf{Shell/Terminal:} bash/zsh/fish möglich (Skripte sind bash-orientiert).
         \item \textbf{Zugriffsrechte:} Installation von Paketen/Toolchains (je nach System via Paketmanager).
         \item \textbf{Versionsverwaltung:} Git.
       \end{itemize}
       
       \subsection{Toolchain und Frameworks}
       Tabelle~\ref{tab:toolchain} fasst die eingesetzten Werkzeuge zusammen. Versionen sind als Mindestempfehlung zu verstehen und können projektabhängig angepasst werden (z.\,B. via \codeinline{.tool-versions}, \codeinline{rust-toolchain.toml} oder \codeinline{package.json}).
       
       \begin{table}[H]
       \centering
       \begin{tblr}{
         colspec = {Q[l,wd=0.28\textwidth] Q[c,wd=0.18\textwidth] Q[l,wd=0.54\textwidth]},
         row{1} = {font=\bfseries, bg=black!6},
         row{even} = {bg=black!2},
         rowsep = 4pt,
         leftsep = 6pt,
         rightsep = 6pt
       }
       \toprule
       Tool/Framework & Version & Zweck im Projekt \\
       \midrule
       Git & >= 2.x & Repository klonen, Branching, Versionsverwaltung \\
       VS Code & aktuell & IDE/Editor; empfohlen für konsistente Formatierung und Debugging \\
       Rust (rustup, cargo) & >= 1.7x & Backend/Build (abhängig vom Projektanteil in Rust) \\
       Node.js & >= 18 LTS & Frontend/Tooling (Build, Dev-Server, Bundling) \\
       Paketmanager (pnpm/yarn/npm) & projektspezifisch & Abhängigkeiten installieren, Scripts ausführen \\
       Control-Skript (\codeinline{control.sh}) & repo-intern & Standardisierte Befehle: Check, Install, Build, Run \\
       \bottomrule
       \end{tblr}
       \caption{Toolchain-Übersicht}
       \label{tab:toolchain}
       \end{table}
       
       
       \subsubsection{Empfohlene VS-Code-Erweiterungen}
       Für eine konsistente Developer Experience werden folgende Erweiterungen empfohlen (optional):
       \begin{itemize}
         \item \textbf{Rust Analyzer} (Rust-IDE-Features)
         \item \textbf{EditorConfig} (einheitliche Formatierung)
         \item \textbf{ESLint} / \textbf{Prettier} (bei JavaScript/TypeScript-Frontend)
       \end{itemize}
       
       \subsection{Setup-Schritte}
       Dieser Abschnitt beschreibt die grundlegenden Setup-Schritte unabhängig vom Betriebssystem. OS-spezifische Installationsbefehle sind im Anhang dokumentiert.
       
       \subsubsection{Repository beziehen}
       \begin{codeblock}[title=Repository klonen]
       git clone <REPO-URL>
       cd <PROJEKT-ORDNER>
       \end{codeblock}
       
       \subsubsection{Abhängigkeiten installieren}
       Wenn das Projekt ein Control-Skript bereitstellt, sollte dieses bevorzugt genutzt werden, da es wiederholbare Abläufe kapselt.
       
       \begin{codeblock}[title=Installation via Control-Skript]
       ./control.sh doctor
       ./control.sh install
       \end{codeblock}
       
       Alternativ können (je nach Projektstruktur) die Abhängigkeiten direkt über den jeweiligen Paketmanager bzw. Cargo installiert werden:
       
       \begin{codeblock}[title=Installation ohne Control-Skript (Beispiel)]
       # Frontend
       pnpm install
       
       # Rust-Anteile (falls erforderlich)
       cargo fetch
       \end{codeblock}
       
       \subsubsection{Projekt starten (Entwicklung)}
       \begin{codeblock}[title=Start (Dev)]
       ./control.sh run
       \end{codeblock}
       
       \subsection{Arch Linux: OS-spezifische Installation (Anhang)}
       Die vollständige Installationsanleitung für Arch Linux inklusive systemabhängiger Pakete und dem vollständigen Setup-Skript ist im Anhang dokumentiert:
       \begin{itemize}
         \item \textbf{Anhang~A:} Installationsskript und Paketliste für Arch Linux
       \end{itemize}
       
       Für weitere Betriebssysteme (z.\,B. Ubuntu/Debian, Fedora, Windows, macOS) kann die Anleitung analog ergänzt werden. Dabei ist insbesondere auf systemabhängige Bibliotheken und Build-Tools zu achten (Compiler, Linker, ggf. UI-Framework-Abhängigkeiten).


📁 FMD/chapters/schluss
  📝 300.tex
     Pfad: 📁 FMD / 📁 chapters / 📁 schluss / 📝 300.tex
     Größe: 1.05 KB (1076 B)
     Geändert: 2025-12-16T20:56:12
     Überschriften: 0, Zeilen: 25, Wörter: 122, Zeichen: 1064
     Inhalt (Auszug): \section{Diskussion und Ausblick} % Zweck: Einordnen, Grenzen und Zukunft aufzeigen
     Inhalt (voll):
       \section{Diskussion und Ausblick}
       % Zweck: Einordnen, Grenzen und Zukunft aufzeigen
       
leer


=== Ordnerbaum (Quelle, nur ausgewählte Typen) ===

📁 .
├── 📁 FMD
│   ├── 📁 chapters
│   │   ├── 📁 einleitung
│   │   │   └── 📝 100.tex
│   │   ├── 📁 hauptteil
│   │   │   └── 📝 200.tex
│   │   └── 📁 schluss
│   │       └── 📝 300.tex
│   └── 📁 image
├── 📝 name.tex
└── 📝 preamble.tex

=== Ordnerbaum (Ausgabeordner) ===

📁 .
├── 📁 FMD
│   ├── 📁 chapters
│   │   ├── 📁 einleitung
│   │   │   └── 📝 100.tex
│   │   ├── 📁 hauptteil
│   │   │   └── 📝 200.tex
│   │   └── 📁 schluss
│   │       └── 📝 300.tex
│   └── 📁 image
│       ├── 📝 Abbildung-1.png
│       ├── 📝 Abbildung-2.png
│       ├── 📝 Abbildung-3.png
│       └── 📝 logo.png
├── 📝 index.json
├── 📝 name.tex
├── 📝 preamble.tex
└── 📝 references.bib
