pub(crate) const SCORE_TITLE: u32 = 3;
pub(crate) const SCORE_TAG: u32 = 2;
pub(crate) const SCORE_SLUG: u32 = 2;
pub(crate) const SCORE_CONTENT: u32 = 1;

/// Which fields of one document a single query term hit.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub(crate) struct FieldHits {
    pub title: bool,
    pub tag: bool,
    pub slug: bool,
    pub content: bool,
}

impl FieldHits {
    pub(crate) fn score(self) -> u32 {
        let mut total = 0;
        if self.title {
            total += SCORE_TITLE;
        }
        if self.tag {
            total += SCORE_TAG;
        }
        if self.slug {
            total += SCORE_SLUG;
        }
        if self.content {
            total += SCORE_CONTENT;
        }
        total
    }
}

/// Every term must hit at least one field (AND); the document score is the sum
/// of the per-term scores. Shared so the in-app search and the MCP search rank
/// the same corpus identically.
pub(crate) fn combine_terms(per_term: impl IntoIterator<Item = FieldHits>) -> u32 {
    let mut total = 0;
    for hits in per_term {
        let score = hits.score();
        if score == 0 {
            return 0;
        }
        total += score;
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    const EVERY_FIELD: FieldHits = FieldHits {
        title: true,
        tag: true,
        slug: true,
        content: true,
    };

    #[test]
    fn sums_every_hit_field() {
        assert_eq!(
            EVERY_FIELD.score(),
            SCORE_TITLE + SCORE_TAG + SCORE_SLUG + SCORE_CONTENT
        );
    }

    #[test]
    fn a_term_matching_nothing_zeroes_the_document() {
        let score = combine_terms([EVERY_FIELD, FieldHits::default()]);
        assert_eq!(score, 0);
    }

    #[test]
    fn no_terms_scores_zero() {
        assert_eq!(combine_terms([]), 0);
    }

    #[test]
    fn title_outranks_content() {
        let title_only = FieldHits {
            title: true,
            ..FieldHits::default()
        };
        let content_only = FieldHits {
            content: true,
            ..FieldHits::default()
        };
        assert!(title_only.score() > content_only.score());
    }
}
