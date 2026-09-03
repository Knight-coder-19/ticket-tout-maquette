# Brand book Ticket Tout — compilation.
#   make          -> brand-book.pdf (deux passes pour le sommaire)
#   make assets   -> regenere les images (carte, logos, captures)
#   make clean    -> fichiers auxiliaires

LATEX := pdflatex -interaction=nonstopmode -halt-on-error -output-directory=build

.PHONY: all clean
all: brand-book.pdf

brand-book.pdf: brand-book.tex $(wildcard assets/*.png)
	@mkdir -p build
	$(LATEX) $< > build/pass1.log 2>&1 || (tail -n 30 build/pass1.log; exit 1)
	$(LATEX) $< > build/pass2.log 2>&1
	@cp build/brand-book.pdf ./brand-book.pdf
	@echo "  -> brand-book.pdf ($$(pdfinfo brand-book.pdf | awk '/Pages/{print $$2}') pages)"

clean:
	rm -f build/*.aux build/*.log build/*.out build/*.toc
