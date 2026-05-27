'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/casos', label: 'Bandeja' },
  { href: '/proveedores', label: 'Proveedores' },
  { href: '/documentos', label: 'Documentos' },
  { href: '/chat', label: 'Agente IA' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="bg-blue-600 text-white px-2 py-1 rounded">A</span>
          <span>AchachAI</span>
          <span className="text-xs font-normal text-gray-500 border-l pl-2 ml-1">
            Detector de posibles fraudes · Aseguradora del Sur
          </span>
        </Link>
        <div className="flex gap-1 ml-auto">
          {links.map(({ href, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  active
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
