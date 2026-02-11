export function parseAttributeTable($, selectors = 'tr') {
  const attrs = {}

  $(selectors).each((_, el) => {
    const labelEl = $(el).find('th, td:first-child, .label')
    const valueEl = $(el).find('td:last-child, td p, .value')
    const label = labelEl.text().toLowerCase().trim()
    const value = valueEl.text().trim()

    if (!label || !value || label === value) return

    if (/origin|p[ôo]vod|country|krajina/.test(label)) {
      const parts = value.split(/[,/]/)
      attrs.country = parts[0]?.trim()
      if (parts[1]) attrs.region = attrs.region || parts[1].trim()
    }
    if (/region|regi[óo]n|oblast|oblasť/.test(label) && !attrs.region) {
      attrs.region = value
    }
    if (/process|spracovanie|processing/.test(label)) {
      attrs.process = value
    }
    if (/roast|pra[žz]enie/.test(label)) {
      attrs.roastLevel = value
    }
    if (/varieta|variety|odroda/.test(label)) {
      attrs.variety = value
    }
    if (/tasting|notes|chu[tť]|profil/.test(label)) {
      attrs.tastingNotes = value
    }
    if (/altitude|nadmorsk|elevation/.test(label)) {
      attrs.altitude = value
    }
  })

  return attrs
}
