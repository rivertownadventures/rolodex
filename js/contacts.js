// Contact importers — Google Contacts (People API) and vCard files (from
// Apple Contacts, etc.). Both return an array of normalized contact objects
// with a consistent shape so they merge into the sheet the same way:
//
//   { name, company, email, phone, notes, photoUrl }

import { getToken } from './auth.js?v=25';

// ----- Google Contacts ----------------------------------------------------

const PEOPLE_API = 'https://people.googleapis.com/v1/people/me/connections';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,organizations,photos,biographies';

export async function fetchGoogleContacts() {
  const token = await getToken();
  const out = [];
  let pageToken = '';
  do {
    const url = `${PEOPLE_API}?personFields=${PERSON_FIELDS}&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Google Contacts ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const person of data.connections || []) {
      out.push(normalizeGooglePerson(person));
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

function normalizeGooglePerson(p) {
  const primary = (arr) => {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.find((x) => x.metadata?.primary) || arr[0];
  };
  const name = primary(p.names);
  const email = primary(p.emailAddresses);
  const phone = primary(p.phoneNumbers);
  const org = primary(p.organizations);
  const photo = primary(p.photos);
  const bio = primary(p.biographies);

  return {
    name: name?.displayName || '',
    company: org?.name || '',
    email: email?.value || '',
    phone: phone?.value || '',
    notes: bio?.value || '',
    photoUrl: photo?.url || '',
  };
}

// ----- vCard (Apple Contacts export, Outlook, etc.) -----------------------

// Handles vCard 3.0 and 4.0. Unfolds continuation lines, splits on
// BEGIN/END:VCARD boundaries, picks the first of each field type.
export function parseVCardFile(text) {
  // RFC 2425 line folding: a line starting with a space/tab is a continuation.
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const blocks = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const out = [];
  for (const block of blocks) {
    const end = block.search(/END:VCARD/i);
    const body = end >= 0 ? block.slice(0, end) : block;
    const contact = parseVCardBlock(body);
    if (contact && (contact.name || contact.email || contact.phone)) {
      out.push(contact);
    }
  }
  return out;
}

function parseVCardBlock(body) {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = (predicate) => {
    for (const line of lines) {
      const m = line.match(/^([^:;]+)(;[^:]*)?:(.*)$/);
      if (!m) continue;
      const [, prop, , value] = m;
      if (predicate(prop.toUpperCase())) return decodeVCardValue(value);
    }
    return '';
  };

  const fn = first((p) => p === 'FN');
  let name = fn;
  if (!name) {
    // Structured name N:Last;First;Middle;Prefix;Suffix
    const n = first((p) => p === 'N');
    if (n) {
      const parts = n.split(';');
      name = [parts[3], parts[1], parts[2], parts[0], parts[4]].filter(Boolean).join(' ').trim();
    }
  }
  const email = first((p) => p === 'EMAIL');
  const phone = first((p) => p === 'TEL');
  const org = first((p) => p === 'ORG').split(';')[0].trim();
  const notes = first((p) => p === 'NOTE');
  const photo = first((p) => p === 'PHOTO');

  return {
    name: name || '',
    company: org,
    email,
    phone,
    notes,
    // PHOTO in modern vCards can be a URI; if it's base64 embedded we skip it.
    photoUrl: photo && /^https?:/i.test(photo) ? photo : '',
  };
}

function decodeVCardValue(v) {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

// ----- Merge into sheet ---------------------------------------------------

// Map a normalized contact into a sheet row according to header order.
// Headers we know how to fill: name, company, email, phone, notes, photoUrl, id.
// Unknown headers get left blank.
export function contactToRow(contact, headers, idField, newId) {
  return headers.map((h) => {
    const key = h.toLowerCase();
    if (h === idField) return newId();
    if (key === 'name' || key === 'fullname') return contact.name;
    if (key === 'company' || key === 'organization' || key === 'org') return contact.company;
    if (key === 'email' || key === 'emailaddress') return contact.email;
    if (key === 'phone' || key === 'phonenumber' || key === 'tel') return contact.phone;
    if (key === 'notes' || key === 'note' || key === 'bio') return contact.notes;
    if (key === 'photourl' || key === 'photo' || key === 'image' || key === 'avatar') return contact.photoUrl;
    return '';
  });
}

// Return only contacts that aren't already in the sheet. Dedup by lower-case name.
export function filterNewContacts(contacts, existingCards) {
  const existing = new Set(
    existingCards
      .map((c) => (c.name || c.fullName || '').toString().trim().toLowerCase())
      .filter(Boolean)
  );
  return contacts.filter((c) => {
    const key = (c.name || '').trim().toLowerCase();
    if (!key) return false;
    if (existing.has(key)) return false;
    existing.add(key); // also dedup against each other within this batch
    return true;
  });
}
