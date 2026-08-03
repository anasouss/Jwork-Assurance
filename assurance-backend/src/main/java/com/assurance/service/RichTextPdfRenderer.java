package com.assurance.service;

import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Text;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.springframework.stereotype.Component;

@Component
public class RichTextPdfRenderer {

    public void addTo(Cell cell, String value) {
        if (value == null || value.isBlank()) {
            cell.add(paragraph("-"));
            return;
        }
        if (!containsHtml(value)) {
            addPlainText(cell, value);
            return;
        }

        Element body = Jsoup.parseBodyFragment(value).body();
        if (body.children().isEmpty()) {
            addPlainText(cell, body.text());
            return;
        }
        for (Element block : body.children()) {
            switch (block.normalName()) {
                case "ul" -> addList(cell, block, false, 0);
                case "ol" -> addList(cell, block, true, 0);
                default -> cell.add(toParagraph(block));
            }
        }
    }

    private void addPlainText(Cell cell, String value) {
        boolean added = false;
        for (String line : value.split("\\R", -1)) {
            if (!line.isBlank()) {
                cell.add(paragraph(line.trim()));
                added = true;
            }
        }
        if (!added) {
            cell.add(paragraph("-"));
        }
    }

    private void addList(Cell cell, Element list, boolean ordered, int depth) {
        int index = 1;
        for (Element item : list.children()) {
            if (!"li".equals(item.normalName())) {
                continue;
            }
            String prefix = "  ".repeat(depth) + (ordered ? index + ". " : "- ");
            Paragraph paragraph = paragraph(prefix);
            appendInlineChildren(item, paragraph, false, false, true);
            cell.add(paragraph);
            for (Element nested : item.children()) {
                if ("ul".equals(nested.normalName()) || "ol".equals(nested.normalName())) {
                    addList(cell, nested, "ol".equals(nested.normalName()), depth + 1);
                }
            }
            index++;
        }
    }

    private Paragraph toParagraph(Element element) {
        Paragraph paragraph = paragraph("");
        appendInlineChildren(element, paragraph, false, false, false);
        return paragraph;
    }

    private void appendInlineChildren(
            Element element,
            Paragraph paragraph,
            boolean bold,
            boolean italic,
            boolean skipNestedLists
    ) {
        boolean nextBold = bold || "strong".equals(element.normalName()) || "b".equals(element.normalName());
        boolean nextItalic = italic || "em".equals(element.normalName()) || "i".equals(element.normalName());
        for (Node child : element.childNodes()) {
            if (child instanceof TextNode textNode) {
                Text text = new Text(textNode.getWholeText());
                if (nextBold) {
                    text.setBold();
                }
                if (nextItalic) {
                    text.setItalic();
                }
                paragraph.add(text);
            } else if (child instanceof Element childElement) {
                String name = childElement.normalName();
                if ("br".equals(name)) {
                    paragraph.add(new Text("\n"));
                } else if (!(skipNestedLists && ("ul".equals(name) || "ol".equals(name)))) {
                    appendInlineChildren(childElement, paragraph, nextBold, nextItalic, skipNestedLists);
                }
            }
        }
    }

    private Paragraph paragraph(String text) {
        return new Paragraph(text).setMargin(0).setMultipliedLeading(1.1f);
    }

    private boolean containsHtml(String value) {
        return value.matches("(?s).*<[/]?[a-zA-Z][^>]*>.*");
    }
}
