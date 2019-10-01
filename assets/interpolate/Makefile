PNGS :=
PNGS += circle-and-square.png
PNGS += circle-on-square.png
PNGS += sampled-square.png

.PHONY: all
all: $(PNGS)

%.png: %.pdf
	convert -density 400 $< -quality 300 $@

%.pdf: %.tex
	pdflatex $<
