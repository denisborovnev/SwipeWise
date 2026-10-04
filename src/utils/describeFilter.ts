import { isFinished, sessionStats } from '@/model/session';
import type { DateFilter, Session, SessionFilter, WordList } from '@/model/types';

import { formatDate, plural } from './format';

export function describeDateFilter(filter: DateFilter): string {
  if ('date' in filter) {
    return formatDate(filter.date);
  }
  if (filter.days === 0) {
    return 'today';
  }
  if (filter.days === 1) {
    return 'yesterday';
  }
  return `${filter.days} days ago`;
}

/** Human-readable summary, e.g. "Travel · added since 7 days ago · don't remember". */
export function describeFilter(filter: SessionFilter, lists: WordList[]): string {
  const parts = [
    filter.listId === 'all' ? 'All words' : (lists.find((l) => l.id === filter.listId)?.name ?? 'Deleted list'),
  ];
  if (filter.addedSince) {
    parts.push(`added since ${describeDateFilter(filter.addedSince)}`);
  }
  if (filter.notRevisedSince) {
    parts.push(
      'days' in filter.notRevisedSince && filter.notRevisedSince.days === 0
        ? 'not revised today'
        : `not revised since ${describeDateFilter(filter.notRevisedSince)}`,
    );
  }
  if (filter.onlyNotRemembered) {
    parts.push("don't remember");
  }
  return parts.join(' · ');
}

/** Filter summary, marking "repeat the words I missed" rounds. */
export function describeSession(session: Session, lists: WordList[]): string {
  const filter = describeFilter(session.filter, lists);
  return session.kind === 'missed' ? `${filter} · missed words` : filter;
}

/** "3 of 10 cards done" or "Finished · knew 7, didn't know 3". */
export function describeProgress(session: Session): string {
  const stats = sessionStats(session);
  return isFinished(session)
    ? `Finished · knew ${stats.remembered}, didn't know ${stats.notRemembered}`
    : `${stats.answered} of ${plural(stats.total, 'card')} done`;
}
