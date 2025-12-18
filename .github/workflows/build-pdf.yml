name: Build PDF

on:
  push:
    branches: ["main"]
    paths-ignore:
      - "docs/FMDFlashcard.pdf"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Build LaTeX (latexmk)
        uses: xu-cheng/latex-action@v4
        with:
          working_directory: docs/FMDFlashcard
          root_file: name.tex
          compiler: latexmk
          args: -pdf -file-line-error -halt-on-error -interaction=nonstopmode
          latexmk_shell_escape: false
          docker_image: ghcr.io/xu-cheng/texlive-full:latest

      - name: Copy PDF to /docs
        run: |
          mkdir -p docs
          cp docs/FMDFlashcard/name.pdf docs/FMDFlashcard.pdf

      - name: Commit PDF to repo (main)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          git add -f docs/FMDFlashcard.pdf
          git commit -m "chore(pdf): update docs/FMDFlashcard.pdf" || exit 0
          git push origin HEAD:main
