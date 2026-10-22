import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import esbuild from 'esbuild';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const componentsDir = path.resolve(__dirname, '../src/components');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-event-manager-test-'));

test.after(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const externalRewritePlugin = {
  name: 'external-rewrite',
  setup(build) {
    build.onResolve({ filter: /^(react|react-dom|framer-motion|lucide-react|\.\.\/)/ }, (args) => {
      const resolved = args.path.startsWith('.')
        ? 'file://' + path.resolve(componentsDir, args.path)
        : import.meta.resolve(args.path);
      return { path: resolved, external: true };
    });
  }
};

async function buildComponent() {
  const outFile = path.join(tmpDir, 'EventManagerModal.mjs');
  await esbuild.build({
    entryPoints: [path.join(componentsDir, 'EventManagerModal.jsx')],
    bundle: true,
    format: 'esm',
    outfile: outFile,
    plugins: [externalRewritePlugin]
  });
  return import(`file://${outFile}`);
}

test('EventManagerModal renders modal header, add event button, and event list', async () => {
  const { default: EventManagerModal } = await buildComponent();

  const dummyEvents = [
    {
      id: 'ev-1',
      name: 'Wedding Kevin & Sheila',
      slug: 'wedding-kevin-sheila',
      description: 'Acara pernikahan Kevin & Sheila di Grand Ballroom',
      status: 'ACTIVE',
      isDefault: true,
      videoBgUrl: '/uploads/media/wedding-bg.mp4',
      config: {
        title: 'Kevin & Sheila Wedding',
        subtitle: 'Selamat Datang di Resepsi',
        coupleNames: 'Kevin & Sheila',
        eventDate: '24 Oktober 2026',
        theme: 'wedding',
        printCopies: 2,
        paperSize: '4R',
        autoPrint: true
      }
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(EventManagerModal, {
      isOpen: true,
      onClose: () => {},
      events: dummyEvents,
      onRefreshEvents: () => {},
      currentEventId: 'ev-1'
    })
  );

  assert.ok(html.includes('Manajemen Event'), 'Should contain title Manajemen Event');
  assert.ok(html.includes('Tambah Event Baru'), 'Should contain Tambah Event Baru button');
  assert.ok(html.includes('Wedding Kevin &amp; Sheila') || html.includes('Wedding Kevin & Sheila'), 'Should render event name');
  assert.ok(html.includes('wedding-kevin-sheila'), 'Should display event slug');
  assert.ok(html.includes('ACTIVE'), 'Should display ACTIVE status badge');
  assert.ok(html.includes('Default') || html.includes('Utama'), 'Should display default badge');
  assert.ok(html.includes('Aktif Saat Ini'), 'Should display currently active kiosk event badge');
});

test('EventManagerModal returns empty markup when isOpen is false', async () => {
  const { default: EventManagerModal } = await buildComponent();

  const html = renderToStaticMarkup(
    React.createElement(EventManagerModal, {
      isOpen: false,
      onClose: () => {},
      events: [],
      onRefreshEvents: () => {}
    })
  );

  assert.equal(html, '', 'Should return empty string / null when closed');
});

test('EventManagerModal renders empty state when events list is empty', async () => {
  const { default: EventManagerModal } = await buildComponent();

  const html = renderToStaticMarkup(
    React.createElement(EventManagerModal, {
      isOpen: true,
      onClose: () => {},
      events: [],
      onRefreshEvents: () => {}
    })
  );

  assert.ok(html.includes('Belum ada event') || html.includes('Tidak ada event'), 'Should display empty state when no events exist');
  assert.ok(html.includes('Tambah Event Baru'), 'Should still show Tambah Event button');
});

test('EventManagerModal renders actions (Edit, Delete, Set Default) for events', async () => {
  const { default: EventManagerModal } = await buildComponent();

  const dummyEvents = [
    {
      id: 'ev-2',
      name: 'Corporate Annual Gala 2026',
      slug: 'corporate-gala-2026',
      description: 'Gala tahunan perusahaan',
      status: 'INACTIVE',
      isDefault: false,
      config: {
        theme: 'general',
        printCopies: 1,
        paperSize: '4R'
      }
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(EventManagerModal, {
      isOpen: true,
      onClose: () => {},
      events: dummyEvents,
      onEventUpdated: () => {}
    })
  );

  assert.ok(html.includes('Corporate Annual Gala 2026'), 'Should render event name');
  assert.ok(html.includes('INACTIVE'), 'Should render INACTIVE status');
  assert.ok(html.includes('Jadikan Default'), 'Should display Jadikan Default button for non-default events');
  assert.ok(html.includes('Edit'), 'Should display Edit button');
  assert.ok(html.includes('Hapus'), 'Should display Hapus button');
});

test('EventManagerModal renders form controls for editing/adding events', async () => {
  const { default: EventManagerModal } = await buildComponent();

  const dummyEvents = [
    {
      id: 'ev-1',
      name: 'Wedding Kevin & Sheila',
      slug: 'wedding-kevin-sheila',
      status: 'ACTIVE',
      isDefault: true,
      config: {
        title: 'Kevin & Sheila Wedding',
        subtitle: 'Resepsi Bahagia',
        coupleNames: 'Kevin & Sheila',
        eventDate: '24 Oktober 2026',
        theme: 'wedding',
        printCopies: 2,
        paperSize: '4R',
        autoPrint: true
      }
    }
  ];

  const html = renderToStaticMarkup(
    React.createElement(EventManagerModal, {
      isOpen: true,
      onClose: () => {},
      events: dummyEvents,
      onRefreshEvents: () => {},
      initialEditingEvent: dummyEvents[0]
    })
  );

  assert.ok(html.includes('Nama Event'), 'Should render Name input label');
  assert.ok(html.includes('Slug URL'), 'Should render Slug field label');
  assert.ok(html.includes('wedding-kevin-sheila'), 'Should display slug value');
  assert.ok(html.includes('Judul Event'), 'Should render Title label');
  assert.ok(html.includes('Sub-judul Event'), 'Should render Subtitle label');
  assert.ok(html.includes('Nama Pasangan / Host'), 'Should render Couple/Host label');
  assert.ok(html.includes('Tanggal Event'), 'Should render Event date label');
  assert.ok(html.includes('Tema Tampilan'), 'Should render Theme selector label');
  assert.ok(html.includes('Video Background'), 'Should render Video background label');
  assert.ok(html.includes('Jumlah Cetak (Copies)'), 'Should render Copies label');
  assert.ok(html.includes('Ukuran Kertas'), 'Should render Paper size label');
  assert.ok(html.includes('Cetak Otomatis (Auto-print)'), 'Should render Auto-print label');
  assert.ok(html.includes('Simpan Event'), 'Should render Simpan Event button');
});
