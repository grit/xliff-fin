// --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
// MARK: - Import

var he = require("he")

// --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
// MARK: - Definition

export enum DocSearchResultDataType {
  contentBlock = "contentBlock",
  sectionHeader = "sectionHeader",
  pageTitle = "pageTitle",
  groupTitle = "groupTitle",
}

export type DocSearchResultData = {
  pageName: string
  text: string
  category: string
  type: DocSearchResultDataType
  url: string
}

const idsOfBlocks: Map<string, number> = new Map()

// --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---
// MARK: - Search index processing

export function buildXLiffOutput(pages: Array<DocumentationPage>, groups: Array<DocumentationGroup>): string {
  // Construct XLiff definition file
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
    <file source-language="en" target-language="jp" datatype="plaintext" original="supernova-documentation.data">
      <header>
        <tool tool-id="supernova.io" tool-name="supernova"/>
      </header>
      <body>
        ${buildXLiffBody(pages, groups)}
      </body>
    </file>
  </xliff>
`
}

function buildXLiffBody(pages: Array<DocumentationPage>, groups: Array<DocumentationGroup>): string {
  let units: Array<string> = []
  for (let page of pages) {
    const blocks = flattenedBlocksOfPage(page)
    const applicableBlocks = blocks.filter(
      (b) =>
        b.type === "Text" ||
        b.type === "Heading" ||
        b.type === "Callout" ||
        b.type === "Quote" ||
        b.type === "OrderedList" ||
        b.type === "UnorderedList"
    )
    units = units.concat(applicableBlocks.map((b) => representBlockAsXLiff(b, page)))

    const shortcutBlocks = blocks.filter((b) => b.type === "Shortcuts") as Array<DocumentationPageBlockShortcuts>
    units = units.concat(...shortcutBlocks.map((b) => representShortcutsAsXLiff(b, page)))
  }

  for (let page of pages) {
    units = units.concat(representPageAsXLiff(page))
  }

  for (let group of groups) {
    if (!group.isRoot) {
      units = units.concat(representGroupAsXLiff(group))
    }
  }

  return units.join("\n")
}

function representGroupAsXLiff(group: DocumentationGroup): Array<string> {
  const title = `  
    <trans-unit id="${group.persistentId}-title">
      <source>${safeEncode(group.title)}</source>
      <target>${safeEncode(group.title)}</target>
      <context-group purpose="location">
        <context context-type="type">Title</context>
        <context context-type="pageid">${group.persistentId}</context>
      </context-group>
    </trans-unit>
  `
  const desc = group?.configuration?.header?.description
  const description =
    desc && desc.length > 0
      ? `  
    <trans-unit id="${group.persistentId}-description">
      <source>${safeEncode(desc)}</source>
      <target>${safeEncode(desc)}</target>
      <context-group purpose="location">
        <context context-type="type">Description</context>
        <context context-type="pageid">${group.persistentId}</context>
      </context-group>
    </trans-unit>
  `
      : undefined

  if (description) {
    return [title, description]
  } else {
    return [title]
  }
}

function representPageAsXLiff(page: DocumentationPage): Array<string> {
  const title = `  
    <trans-unit id="${page.persistentId}-title">
      <source>${safeEncode(page.title)}</source>
      <target>${safeEncode(page.title)}</target>
      <context-group purpose="location">
        <context context-type="type">Title</context>
        <context context-type="pageid">${page.persistentId}</context>
      </context-group>
    </trans-unit>
  `
  const desc = page?.configuration?.header?.description
  const description =
    desc && desc.length > 0
      ? `  
    <trans-unit id="${page.persistentId}-description">
      <source>${safeEncode(desc)}</source>
      <target>${safeEncode(desc)}</target>
      <context-group purpose="location">
        <context context-type="type">Description</context>
        <context context-type="pageid">${page.persistentId}</context>
      </context-group>
    </trans-unit>
  `
      : undefined

  if (description) {
    return [title, description]
  } else {
    return [title]
  }
}

function representBlockAsXLiff(block: DocumentationPageBlock, page: DocumentationPage): string {
  const text = textBlockPlainText(block as DocumentationPageBlockText)

  const noOfEntries = idsOfBlocks.get(block.id)
  if (noOfEntries !== undefined && noOfEntries > 0) {
    idsOfBlocks.set(block.id, noOfEntries + 1)
  } else {
    idsOfBlocks.set(block.id, 1)
  }

  return `  
    <trans-unit id="${block.id}${noOfEntries !== undefined && noOfEntries > 0 ? `-${noOfEntries}` : ``}">
      <source>${safeEncode(text)}</source>
      <target>${safeEncode(text)}</target>
      <context-group purpose="location">
        <context context-type="blocktype">${block.type}</context>
        <context context-type="pageid">${page.persistentId}</context>
      </context-group>
    </trans-unit>
  `
}

function representShortcutsAsXLiff(block: DocumentationPageBlockShortcuts, page: DocumentationPage): Array<string> {
  const pieces: Array<string> = []

  let index = 0
  for (let shortcut of block.shortcuts) {
    if (shortcut.title && shortcut.title.length > 0) {
      const text = safeEncode(shortcut.title)
      const piece = `  
        <trans-unit id="${block.id}-${index}-title">
          <source>${safeEncode(text)}</source>
          <target>${safeEncode(text)}</target>
          <context-group purpose="location">
            <context context-type="blocktype">${block.type}</context>
            <context context-type="index">${index}</context>
            <context context-type="subtype">Title</context>
            <context context-type="pageid">${page.persistentId}</context>
          </context-group>
        </trans-unit>
      `
      pieces.push(piece)
    }
    if (shortcut.description && shortcut.description.length > 0) {
      const text = safeEncode(shortcut.description)
      const piece = `  
        <trans-unit id="${block.id}-${index}-description">
          <source>${safeEncode(text)}</source>
          <target>${safeEncode(text)}</target>
          <context-group purpose="location">
            <context context-type="blocktype">${block.type}</context>
            <context context-type="index">${index}</context>
            <context context-type="subtype">Description</context>
            <context context-type="pageid">${page.persistentId}</context>
          </context-group>
        </trans-unit>
      `
      pieces.push(piece)
    }
    index += 1
  }

  return pieces
}

function flattenedBlocksOfPage(page: DocumentationPage): Array<DocumentationPageBlock> {
  let blocks: Array<DocumentationPageBlock> = page.blocks
  for (let block of page.blocks) {
    blocks = blocks.concat(flattenedBlocksOfBlock(block))
  }

  return blocks
}

function flattenedBlocksOfBlock(block: DocumentationPageBlock): Array<DocumentationPageBlock> {
  let subblocks: Array<DocumentationPageBlock> = block.children
  for (let subblock of block.children) {
    subblocks = subblocks.concat(flattenedBlocksOfBlock(subblock))
  }
  return subblocks
}

function textBlockPlainText(header: DocumentationPageBlockText): string {
  return header.text.spans.map((s) => s.text).join("")
}

function safeEncode(text: string): string {
  return he
    .escape(text)
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
}
