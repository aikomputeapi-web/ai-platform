import Link from 'next/link';

export default function Footer() {
  return (
    <footer
      className="max-w-3xl mx-auto w-full px-6 py-6 border-t font-mono flex items-center justify-between"
      style={{ borderColor: 'var(--color-border)', fontSize: '10px', color: 'var(--color-grey-dim)' }}
    >
      <span>© 2026</span>
      <div className="flex gap-5">
        <Link href="/docs" className="hover:text-white">Docs</Link>
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </div>
    </footer>
  );
}