const FALLBACK_SLUG: &str = "untitled";
const MAX_SLUG_CHARS: usize = 80;

pub fn slugify(input: &str) -> String {
    let mut slug = String::new();
    let mut pending_dash = false;
    for c in input.chars() {
        if c.is_alphanumeric() {
            if pending_dash && !slug.is_empty() {
                slug.push('-');
            }
            slug.extend(c.to_lowercase());
            pending_dash = false;
        } else {
            pending_dash = true;
        }
        if slug.chars().count() >= MAX_SLUG_CHARS {
            break;
        }
    }
    if slug.is_empty() {
        FALLBACK_SLUG.to_string()
    } else {
        slug
    }
}

pub fn unique_slug(base: &str, exists: impl Fn(&str) -> bool) -> String {
    if !exists(base) {
        return base.to_string();
    }
    let mut n = 2u32;
    loop {
        let candidate = format!("{base}-{n}");
        if !exists(&candidate) {
            return candidate;
        }
        n += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugifies_titles() {
        assert_eq!(slugify("Hello, World!"), "hello-world");
        assert_eq!(slugify("  --Weird__ spacing  "), "weird-spacing");
        assert_eq!(slugify("API v2.0 Design"), "api-v2-0-design");
        assert_eq!(slugify("مرحبا بالعالم"), "مرحبا-بالعالم");
        assert_eq!(slugify("!!!"), "untitled");
    }

    #[test]
    fn caps_slug_length() {
        let long = "a".repeat(500);
        assert_eq!(slugify(&long).chars().count(), MAX_SLUG_CHARS);
    }

    #[test]
    fn resolves_collisions_with_counter() {
        let taken = ["doc", "doc-2"];
        assert_eq!(unique_slug("doc", |s| taken.contains(&s)), "doc-3");
        assert_eq!(unique_slug("fresh", |s| taken.contains(&s)), "fresh");
    }
}
