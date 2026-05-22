import { HelpCircle } from 'lucide-react';

interface VNextHelpLinkProps {
  href: string;
  label?: string;
}

/**
 * Small "?" icon link that opens the vNext documentation page for an
 * `x-*` keyword in a new tab. The shell hides the link when `docHref`
 * is omitted on the card, so cards without a public doc page get no
 * affordance instead of a dead link.
 */
export function VNextHelpLink({ href, label = 'Open documentation' }: VNextHelpLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      title={label}
      className="inline-grid size-5 place-items-center rounded text-primary-text/55 hover:text-primary-text"
      onClick={(event) => event.stopPropagation()}>
      <HelpCircle size={12} />
    </a>
  );
}
