function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
}

function formatViews(views) {
    if (!views) return 'N/A';
    return new Intl.NumberFormat().format(views);
}

// Matrix rain effect
function initMatrix() {
    const canvas = document.getElementById('matrix-bg');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const characters = "01";
    const fontSize = 14;
    const columns = canvas.width/fontSize;
    const drops = [];

    for(let x = 0; x < columns; x++) {
        drops[x] = 1;
    }

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0F0';
        ctx.font = fontSize + 'px monospace';

        for(let i = 0; i < drops.length; i++) {
            const text = characters.charAt(Math.floor(Math.random() * characters.length));
            ctx.fillText(text, i*fontSize, drops[i]*fontSize);

            if(drops[i]*fontSize > canvas.height && Math.random() > 0.975)
                drops[i] = 0;

            drops[i]++;
        }
    }

    setInterval(draw, 33);
}

document.addEventListener('DOMContentLoaded', function() {
    initMatrix();
    const searchForm = document.getElementById('searchForm');
    const searchResults = document.getElementById('searchResults');
    const downloadOptions = document.getElementById('downloadOptions');
    const downloadForm = document.getElementById('downloadForm');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const videoUrlInput = document.getElementById('videoUrl');

    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const query = document.getElementById('searchQuery').value;
        
        try {
            showLoading(true);
            searchResults.innerHTML = '';
            downloadOptions.classList.add('d-none');

            const response = await fetch('/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `query=${encodeURIComponent(query)}`
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            displaySearchResults(data.results);
        } catch (error) {
            showError('Search failed: ' + error.message);
        } finally {
            showLoading(false);
        }
    });

    downloadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const url = videoUrlInput.value;
        const format = document.querySelector('input[name="format"]:checked').value;

        try {
            showLoading(true);
            
            const formData = new FormData();
            formData.append('url', url);
            formData.append('format', format);

            const response = await fetch('/download', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Download failed');
            }

            // Create a blob from the response and trigger download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const contentDisposition = response.headers.get('content-disposition');
            const fileName = contentDisposition ? 
                decodeURIComponent(contentDisposition.split('filename=')[1].replace(/['"]/g, '')) : 
                'download';
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();

        } catch (error) {
            showError('Download failed: ' + error.message);
        } finally {
            showLoading(false);
        }
    });

    function displaySearchResults(results) {
        searchResults.innerHTML = '';

        if (!results.length) {
            searchResults.innerHTML = '<div class="alert alert-info">No results found</div>';
            return;
        }

        results.forEach(result => {
            const resultElement = document.createElement('div');
            resultElement.className = 'list-group-item list-group-item-action';
            resultElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h5 class="mb-1">${result.title}</h5>
                        <p class="mb-1 small text-muted">${result.description || 'No description available'}</p>
                        <div class="d-flex flex-wrap gap-3 mt-2">
                            <small class="text-muted">
                                <i class="fas fa-user"></i> ${result.uploader}
                            </small>
                            <small class="text-muted">
                                <i class="fas fa-clock"></i> ${result.duration}
                            </small>
                            <small class="text-muted">
                                <i class="fas fa-eye"></i> ${formatViews(result.view_count)} views
                            </small>
                            <small class="text-muted">
                                <i class="fas fa-calendar"></i> ${formatDate(result.upload_date)}
                            </small>
                            <small class="text-muted">
                                <i class="fas fa-file"></i> ~${formatFileSize(result.filesize_approx)}
                            </small>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary select-video ms-3" 
                            data-url="${result.url}">
                        <i class="fas fa-download"></i> Select
                    </button>
                </div>
            `;
            searchResults.appendChild(resultElement);
        });

        // Add click handlers for select buttons
        document.querySelectorAll('.select-video').forEach(button => {
            button.addEventListener('click', function() {
                videoUrlInput.value = this.dataset.url;
                downloadOptions.classList.remove('d-none');
                downloadOptions.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    function showLoading(show) {
        loadingSpinner.classList.toggle('d-none', !show);
    }

    function showError(message) {
        const alertElement = document.createElement('div');
        alertElement.className = 'alert alert-danger alert-dismissible fade show';
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        searchResults.insertBefore(alertElement, searchResults.firstChild);
    }
});