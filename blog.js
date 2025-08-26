// Blog storage and editor logic with optional GitHub sync
(function() {
    const STORAGE_KEYS = {
        drafts: 'portfolio_blog_drafts',
        posts: 'portfolio_blog_posts',
        gh: 'portfolio_github_settings'
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

    function removeById(arr, id) { return arr.filter(x => x.id !== id); }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // GitHub settings
    function getGhSettings() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.gh)) || null; } catch { return null; }
    }
    function setGhSettings(s) { localStorage.setItem(STORAGE_KEYS.gh, JSON.stringify(s || {})); }
    function hasGhConfig() { const s = getGhSettings(); return s && s.owner && s.repo && s.branch && s.token; }

    // GitHub API Client (Contents API)
    const GitHubClient = {
        async request(path, method = 'GET', body) {
            const s = getGhSettings();
            const url = `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/${path}`;
            const headers = { 'Accept': 'application/vnd.github+json', 'Authorization': `token ${s.token}` };
            const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
            if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
            return res.json();
        },
        async getContentSha(path) {
            try {
                const data = await this.request(`contents/${path}`);
                return data && data.sha ? data.sha : null;
            } catch (e) {
                return null; // not found
            }
        },
        async putFile(path, contentText, message) {
            const s = getGhSettings();
            const sha = await this.getContentSha(path);
            const base64 = btoa(unescape(encodeURIComponent(contentText)));
            return this.request(`contents/${path}`, 'PUT', { message, content: base64, branch: s.branch, sha: sha || undefined });
        },
        async readRaw(path) {
            const s = getGhSettings();
            const url = `https://raw.githubusercontent.com/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/${encodeURIComponent(s.branch)}/${path}`;
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
            return res.text();
        },
        async readJson(path) {
            const txt = await this.readRaw(path).catch(() => '');
            if (!txt) return null;
            try { return JSON.parse(txt); } catch { return null; }
        }
    };

    // Local store API
    const BlogStore = {
        getDrafts() { return loadArray(STORAGE_KEYS.drafts); },
        getPosts() { return loadArray(STORAGE_KEYS.posts); },
        getPostById(id) { return this.getPosts().find(p => p.id === id); },
        saveDraft(draft) { saveArray(STORAGE_KEYS.drafts, upsert(this.getDrafts(), draft)); },
        deleteDraft(id) { saveArray(STORAGE_KEYS.drafts, removeById(this.getDrafts(), id)); },
        publish(post) { saveArray(STORAGE_KEYS.posts, upsert(this.getPosts(), post)); },
        deletePost(id) { saveArray(STORAGE_KEYS.posts, removeById(this.getPosts(), id)); }
    };
    window.BlogStore = BlogStore;

    // Editor logic
    const editorContainer = document.querySelector('#editor');
    if (editorContainer) {
        const quill = new Quill('#editor', {
            theme: 'snow',
            placeholder: 'Write your story... Paste images directly, or use the toolbar image button.',
            modules: { toolbar: { container: '#toolbar', handlers: { image: imageHandler } } }
        });
        function imageHandler() {
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

        const titleInput = document.getElementById('post-title');
        const coverInput = document.getElementById('cover-input');
        const coverPreview = document.getElementById('cover-preview');
        const draftList = document.getElementById('draft-list');
        const saveDraftLocalBtn = document.getElementById('save-draft-local');
        const saveDraftGhBtn = document.getElementById('save-draft-gh');
        const publishBtn = document.getElementById('publish');
        const modeIndicator = document.getElementById('mode-indicator');

        const ghOwner = document.getElementById('gh-owner');
        const ghRepo = document.getElementById('gh-repo');
        const ghBranch = document.getElementById('gh-branch');
        const ghToken = document.getElementById('gh-token');
        const ghSave = document.getElementById('gh-save');
        const ghClear = document.getElementById('gh-clear');
        const ghTest = document.getElementById('gh-test');

        let currentDraftId = null;
        let coverDataUrl = '';

        function refreshMode() {
            modeIndicator.textContent = hasGhConfig() ? 'Mode: GitHub (Publishing enabled)' : 'Mode: Local Storage';
        }
        refreshMode();

        // Load settings
        (function loadSettings(){
            const s = getGhSettings();
            if (!s) return;
            ghOwner.value = s.owner || '';
            ghRepo.value = s.repo || '';
            ghBranch.value = s.branch || 'main';
            if (s.token) ghToken.value = s.token;
        })();

        ghSave.addEventListener('click', () => {
            setGhSettings({ owner: ghOwner.value.trim(), repo: ghRepo.value.trim(), branch: ghBranch.value.trim() || 'main', token: ghToken.value.trim() });
            alert('GitHub settings saved locally.');
            refreshMode();
        });
        ghClear.addEventListener('click', () => {
            setGhSettings({});
            ghOwner.value = ghRepo.value = ghToken.value = '';
            ghBranch.value = 'main';
            alert('GitHub settings cleared.');
            refreshMode();
        });
        ghTest.addEventListener('click', async () => {
            try {
                const s = getGhSettings();
                if (!s || !s.owner || !s.repo || !s.branch || !s.token) { alert('Please fill all settings including token.'); return; }
                await GitHubClient.request('', 'GET'); // repo API root
                alert('GitHub access OK.');
            } catch(e) {
                alert('GitHub access failed. Check token, repo, branch.');
            }
        });

        coverInput.addEventListener('change', async () => {
            const file = coverInput.files && coverInput.files[0];
            if (!file) return;
            coverDataUrl = await fileToDataUrl(file);
            coverPreview.innerHTML = `<img src="${coverDataUrl}" alt="Cover" />`;
        });

        function gatherPostData() {
            const title = (titleInput.value || '').trim();
            const content = quill.root.innerHTML;
            const plainText = quill.getText().trim();
            const excerpt = plainText.slice(0, 180) + (plainText.length > 180 ? '…' : '');
            const now = Date.now();
            return { id: currentDraftId || generateId(), title, content, cover: coverDataUrl, excerpt, updatedAt: now, createdAt: now };
        }

        function listDrafts() {
            const drafts = BlogStore.getDrafts().sort((a,b) => b.updatedAt - a.updatedAt);
            draftList.innerHTML = '';
            drafts.forEach(d => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${d.title || 'Untitled'} <small style="color:#888">(${new Date(d.updatedAt).toLocaleString()})</small></span>`;
                const actions = document.createElement('div');
                actions.className = 'draft-actions';
                const loadBtn = document.createElement('button'); loadBtn.className = 'btn btn-secondary'; loadBtn.textContent = 'Load'; loadBtn.onclick = () => loadDraft(d.id);
                const delBtn = document.createElement('button'); delBtn.className = 'btn'; delBtn.textContent = 'Delete'; delBtn.onclick = () => { BlogStore.deleteDraft(d.id); listDrafts(); };
                actions.appendChild(loadBtn); actions.appendChild(delBtn); li.appendChild(actions); draftList.appendChild(li);
            });
        }
        function loadDraft(id) {
            const draft = BlogStore.getDrafts().find(d => d.id === id);
            if (!draft) return;
            currentDraftId = id;
            titleInput.value = draft.title || '';
            coverDataUrl = draft.cover || '';
            coverPreview.innerHTML = coverDataUrl ? `<img src="${coverDataUrl}" alt="Cover" />` : '<span>Cover</span>';
            document.querySelector('#editor .ql-editor').innerHTML = draft.content || '';
        }

        saveDraftLocalBtn.addEventListener('click', () => {
            const data = gatherPostData();
            BlogStore.saveDraft(data);
            currentDraftId = data.id;
            alert('Draft saved locally');
            listDrafts();
        });

        async function upsertIndex(kind, meta) {
            // kind: 'posts' | 'drafts'; meta minimal fields
            const filename = `${kind}/index.json`;
            const existing = await GitHubClient.readJson(filename) || [];
            const filtered = existing.filter(x => x.id !== meta.id);
            filtered.push(meta);
            // newest first
            filtered.sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0));
            await GitHubClient.putFile(filename, JSON.stringify(filtered, null, 2), `chore: update ${kind} index (${meta.id})`);
        }

        async function saveToGitHub(kind, data) {
            const path = `${kind}/${data.id}.json`;
            await GitHubClient.putFile(path, JSON.stringify(data, null, 2), `${kind === 'posts' ? 'feat: publish post' : 'chore: save draft'} (${data.id})`);
            const meta = { id: data.id, title: data.title, excerpt: data.excerpt, cover: data.cover, updatedAt: data.updatedAt, createdAt: data.createdAt };
            await upsertIndex(kind, meta);
        }

        saveDraftGhBtn.addEventListener('click', async () => {
            if (!hasGhConfig()) { alert('Configure GitHub settings first.'); return; }
            const data = gatherPostData();
            try { await saveToGitHub('drafts', data); alert('Draft saved to GitHub.'); } catch(e) { alert('Failed saving draft to GitHub.'); }
        });

        publishBtn.addEventListener('click', async () => {
            const data = gatherPostData();
            if (!data.title || !data.content.replace(/<(.|\n)*?>/g, '').trim()) { alert('Please add a title and some content.'); return; }
            if (hasGhConfig()) {
                try {
                    await saveToGitHub('posts', data);
                    // remove local draft with same id to avoid confusion
                    BlogStore.deleteDraft(data.id);
                    listDrafts();
                    window.location.href = `post.html?id=${encodeURIComponent(data.id)}`;
                } catch(e) {
                    alert('Failed publishing to GitHub. Check settings/token.');
                }
            } else {
                BlogStore.publish(data);
                BlogStore.deleteDraft(data.id);
                listDrafts();
                window.location.href = `post.html?id=${encodeURIComponent(data.id)}`;
            }
        });

        listDrafts();
    }

    // Reader page
    const postContainer = document.querySelector('#post');
    if (postContainer) {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        (async function(){
            let post = null;
            // Try GitHub raw first if configured (public repo)
            const s = getGhSettings();
            if (s && s.owner && s.repo && s.branch) {
                try {
                    const txt = await GitHubClient.readRaw(`posts/${id}.json`);
                    post = JSON.parse(txt);
                } catch {}
            }
            if (!post) post = BlogStore.getPostById(id);
            if (!post) {
                const empty = document.getElementById('empty');
                if (empty) empty.style.display = 'block';
                return;
            }
            const date = new Date(post.createdAt || post.updatedAt);
            const cover = post.cover ? `<img src="${post.cover}" class="post-cover" alt="Cover">` : '';
            postContainer.innerHTML = `${cover}<h1 class="post-title">${escapeHtml(post.title)}</h1><div class="post-meta">${date.toDateString()}</div><article class="post-content">${post.content}</article><div class="reader-actions"><a class="btn btn-secondary" href="blog.html">Write</a><button id="share" class="btn btn-primary">Share</button></div>`;
            const shareBtn = document.getElementById('share');
            if (shareBtn) {
                shareBtn.addEventListener('click', async () => {
                    const shareData = { title: post.title, text: post.excerpt || '', url: window.location.href };
                    if (navigator.share) { try { await navigator.share(shareData); } catch {} }
                    else { navigator.clipboard.writeText(window.location.href); alert('Link copied to clipboard'); }
                });
            }
        })();
    }

    function escapeHtml(unsafe) {
        return String(unsafe).replace(/[&<"'>]/g, function(m) {
            switch (m) { case '&': return '&amp;'; case '<': return '&lt;'; case '"': return '&quot;'; case "'": return '&#039;'; case '>': return '&gt;'; default: return m; }
        });
    }
})();
