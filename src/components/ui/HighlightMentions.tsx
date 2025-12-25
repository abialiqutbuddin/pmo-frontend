import React from 'react';

interface HighlightMentionsProps {
    content: string;
    mentionClassName?: string;
    className?: string; // Wrapper class
}

/**
 * Renders text with @mentions highlighted.
 * Matches @Name or @Email pattern.
 * A simplified regex: /(@[a-zA-Z0-9_.-]+(?:\s[a-zA-Z0-9_.-]+)*)/g
 * But names can have spaces. We often need a robust way.
 * Since we don't store structured mention ranges, we rely on text matching.
 * We'll match @Word or @Word Word (up to 2-3 words?)
 * Use a simple heuristic or match against known usernames if needed?
 * For now, just match @Someting
 */
export const HighlightMentions: React.FC<HighlightMentionsProps> = ({
    content,
    mentionClassName = "text-blue-600 font-medium",
    className = ""
}) => {
    if (!content) return null;

    // Regex to match @User Name or @email.
    // It's tricky without a delimiter.
    // We'll stick to a simpler regex that matches @ followed by non-whitespace, 
    // OR we can assume mentions are formatted as @Firstname sometimes with space?
    // Let's assume mentions are "@Name" where Name might have spaces.
    // Since we control input, we inserted "@Name ".
    // Let's try matching "@" followed by word chars.

    // Better approach: Split by space and look for words starting with @?
    // But names have spaces.

    // Let's try a regex that matches @[A-Za-z0-9._]+
    // user screenshot shows "@abiali".

    const parts = content.split(/(@[\w\.]+)/g);

    return (
        <span className={className}>
            {parts.map((part, i) => {
                if (part.startsWith('@') && part.length > 1) {
                    return (
                        <span key={i} className={mentionClassName}>
                            {part}
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};
