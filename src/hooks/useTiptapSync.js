import { useEffect, useRef } from 'react';

export const useTiptapSync = (editor, tiptapContent, setTiptapContent) => {
    const isSettingContent = useRef(false);
    const lastSetContent = useRef(null);

    // Sync context to editor
    useEffect(() => {
        if (!editor || tiptapContent === undefined) return;

        const currentContent = editor.getJSON();
        const isSameContent = JSON.stringify(currentContent) === JSON.stringify(tiptapContent);

        if (isSameContent) return;

        isSettingContent.current = true;
        lastSetContent.current = tiptapContent;

        try {
            if (tiptapContent === null || tiptapContent === '') {
                editor.commands.clearContent();
            } else if (tiptapContent?.type === 'doc') {
                editor.commands.setContent(tiptapContent);
            }
        } finally {
            requestAnimationFrame(() => {
                isSettingContent.current = false;
            });
        }
    }, [editor, tiptapContent]);

    // Sync editor to context
    useEffect(() => {
        if (!editor) return;

        let updateTimeout;

        const updateHandler = () => {
            if (updateTimeout) clearTimeout(updateTimeout);

            updateTimeout = setTimeout(() => {
                if (!isSettingContent.current) {
                    const content = editor.getJSON();
                    if (JSON.stringify(content) !== JSON.stringify(lastSetContent.current)) {
                        setTiptapContent(content);
                        lastSetContent.current = content;
                    }
                }
            }, 100);
        };

        editor.on('update', updateHandler);
        return () => {
            editor.off('update', updateHandler);
            if (updateTimeout) clearTimeout(updateTimeout);
        };
    }, [editor, setTiptapContent]);
};