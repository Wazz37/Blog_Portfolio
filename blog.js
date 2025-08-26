// Blog storage and editor logic
(function() {
    const STORAGE_KEYS = {
        drafts: 'portfolio_blog_drafts',
        posts: 'portfolio_blog_posts'
    };

    function generateId() {
        return 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function loadArray(key) {
        try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
    }

    function saveArray(key, arr) {
        localStorage.setItem(key, JSON.stringify(arr));
    }

    function upsert(arr, item, idField = 'id') {
        const idx = arr.findIndex(x => x[idField] === item[idField]);
        if (idx >= 0) { arr[idx] = item; } else { arr.push(item); }
        return arr;
    }

    function removeById(arr, id) {
        return arr.filter(x => x.id !== id);
    }

    // Image handling: convert File/ClipboardImage to base64
    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Expose storage API
    const BlogStore = {
        getDrafts() { return loadArray(STORAGE_KEYS.drafts); },
        getPosts() { return loadArray(STORAGE_KEYS.posts); },
        getPostById(id) { return this.getPosts().find(p => p.id === id); },
        saveDraft(draft) {
            const drafts = this.getDrafts();
            saveArray(STORAGE_KEYS.drafts, upsert(drafts, draft));
        },
        deleteDraft(id) {
            saveArray(STORAGE_KEYS.drafts, removeById(this.getDrafts(), id));
        },
        publish(post) {
            const posts = this.getPosts();
            saveArray(STORAGE_KEYS.posts, upsert(posts, post));
        },
        deletePost(id) {
            saveArray(STORAGE_KEYS.posts, removeById(this.getPosts(), id));
        }
    };

    // Attach to window for other pages
    window.BlogStore = BlogStore;

    // Initialize Editor page if present
    const editorContainer = document.querySelector('#editor');
    if (editorContainer) {
        // Setup Quill
        const quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Write your story... Paste images directly, or use the toolbar image button.',
            modules: {
                toolbar: {
                    container: '#toolbar',
                    handlers: {
                        image: async function() {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async () => {
                                const file = input.files && input.files[0];
                                if (!file) return;
                                const dataUrl = await fileToDataUrl(file);
                                const range = quill.getSelection(true);
                                quill.insertEmbed(range.index, 'image', dataUrl, 'user');
                                quill.setSelection(range.index + 1, 0);
                            };
                            input.click();
                        }
                    }
                }
            }
        });

        // Handle pasted images from clipboard
        editorContainer.addEventListener('paste', async (e) => {
            if (!e.clipboardData) return;
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        e.preventDefault();
                        const dataUrl = await fileToDataUrl(blob);
                        const range = quill.getSelection(true);
                        quill.insertEmbed(range.index, 'image', dataUrl, 'user');
                        quill.setSelection(range.index + 1, 0);
                    }
                }
            }
        });

        // DOM references
        const titleInput = document.getElementById('post-title');
        const coverInput = document.getElementById('cover-input');
        const coverPreview = document.getElementById('cover-preview');
        const draftList = document.getElementById('draft-list');
        const saveDraftBtn = document.getElementById('save-draft');
        const publishBtn = document.getElementById('publish');

        let currentDraftId = null;
        let coverDataUrl = '';

        coverInput.addEventListener('change', async () => {
            const file = coverInput.files && coverInput.files[0];
            if (!file) return;
            coverDataUrl = await fileToDataUrl(file);
            coverPreview.innerHTML = `<img src="${coverDataUrl}" alt="Cover" />`;
        });

        function readEditorHtml() {
            return quill.root.innerHTML;
        }

        function listDrafts() {
            const drafts = BlogStore.getDrafts().sort((a,b) => b.updatedAt - a.updatedAt);
            draftList.innerHTML = '';
            drafts.forEach(d => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${d.title || 'Untitled'} <small style="color:#888">(${new Date(d.updatedAt).toLocaleString()})</small></span>`;
                const actions = document.createElement('div');
                actions.className = 'draft-actions';
                const loadBtn = document.createElement('button');
                loadBtn.className = 'btn btn-secondary';
                loadBtn.textContent = 'Load';
                loadBtn.onclick = () => loadDraft(d.id);
                const delBtn = document.createElement('button');
                delBtn.className = 'btn';
                delBtn.textContent = 'Delete';
                delBtn.onclick = () => { BlogStore.deleteDraft(d.id); listDrafts(); };
                actions.appendChild(loadBtn);
                actions.appendChild(delBtn);
                li.appendChild(actions);
                draftList.appendChild(li);
            });
        }

        function loadDraft(id) {
            const draft = BlogStore.getDrafts().find(d => d.id === id);
            if (!draft) return;
            currentDraftId = id;
            titleInput.value = draft.title || '';
            coverDataUrl = draft.cover || '';
            coverPreview.innerHTML = coverDataUrl ? `<img src="${coverDataUrl}" alt="Cover" />` : '<span>Cover</span>';
            quill.root.innerHTML = draft.content || '';
        }

        function gatherPostData() {
            const title = (titleInput.value || '').trim();
            const content = readEditorHtml();
            const plainText = quill.getText().trim();
            const excerpt = plainText.slice(0, 180) + (plainText.length > 180 ? '…' : '');
            const now = Date.now();
            return { id: currentDraftId || generateId(), title, content, cover: coverDataUrl, excerpt, updatedAt: now, createdAt: now };
        }

        saveDraftBtn.addEventListener('click', () => {
            const data = gatherPostData();
            BlogStore.saveDraft(data);
            currentDraftId = data.id;
            alert('Draft saved');
            listDrafts();
        });

        publishBtn.addEventListener('click', () => {
            const data = gatherPostData();
            if (!data.title || !data.content.replace(/<(.|\n)*?>/g, '').trim()) {
                alert('Please add a title and some content.');
                return;
            }
            BlogStore.publish(data);
            BlogStore.deleteDraft(data.id);
            currentDraftId = data.id;
            listDrafts();
            window.location.href = `post.html?id=${encodeURIComponent(data.id)}`;
        });

        // Initial
        listDrafts();
    }

    // Initialize Reader page if present
    const postContainer = document.querySelector('#post');
    if (postContainer) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const post = id ? BlogStore.getPostById(id) : null;
        if (!post) {
            const empty = document.getElementById('empty');
            if (empty) empty.style.display = 'block';
        } else {
            const date = new Date(post.createdAt || post.updatedAt);
            const cover = post.cover ? `<img src="${post.cover}" class="post-cover" alt="Cover">` : '';
            postContainer.innerHTML = `
                ${cover}
                <h1 class="post-title">${escapeHtml(post.title)}</h1>
                <div class="post-meta">${date.toDateString()}</div>
                <article class="post-content">${post.content}</article>
                <div class="reader-actions">
                    <a class="btn btn-secondary" href="blog.html">Write</a>
                    <button id="share" class="btn btn-primary">Share</button>
                </div>
            `;

            const shareBtn = document.getElementById('share');
            if (shareBtn) {
                shareBtn.addEventListener('click', async () => {
                    const shareData = { title: post.title, text: post.excerpt || '', url: window.location.href };
                    if (navigator.share) {
                        try { await navigator.share(shareData); } catch {}
                    } else {
                        navigator.clipboard.writeText(window.location.href);
                        alert('Link copied to clipboard');
                    }
                });
            }
        }
    }

    // Helper
    function escapeHtml(unsafe) {
        return String(unsafe).replace(/[&<"'>]/g, function(m) {
            switch (m) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '"': return '&quot;';
                case "'": return '&#039;';
                case '>': return '&gt;';
                default: return m;
            }
        });
    }
})();
