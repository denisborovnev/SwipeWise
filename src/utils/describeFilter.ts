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

/** "All words", "Travel", "Travel, Food" or "Travel, Food +2 more". */
function describeLists(listIds: string[], lists: WordList[]): string {
  if (listIds.length === 0) {
    return 'All words';
  }
  const names = lists
    .filter((l) => listIds.includes(l.id))
    .map((l) => l.name)
    .sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    return 'Deleted list';
  }
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

/** Human-readable summary, e.g. "Travel · added since 7 days ago · don't remember". */
export function describeFilter(filter: SessionFilter, lists: WordList[]): string {
  const parts = [describeLists(filter.listIds, lists)];
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
