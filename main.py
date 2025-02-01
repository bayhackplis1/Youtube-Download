import os
import logging
from flask import Flask, render_template, request, jsonify, send_file
import yt_dlp
from urllib.parse import urlparse
import tempfile

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = "youtube_downloader_secret_key"

def is_valid_youtube_url(url):
    """Validate if the given URL is a YouTube URL"""
    try:
        parsed = urlparse(url)
        return 'youtube.com' in parsed.netloc or 'youtu.be' in parsed.netloc
    except:
        return False

def search_youtube(query, max_results=5):
    """Search YouTube for videos"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,  # Changed to False to get full video info
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            if is_valid_youtube_url(query):
                info = ydl.extract_info(query, download=False)
                return [info]
            else:
                results = ydl.extract_info(f"ytsearch{max_results}:{query}", download=False)
                return results['entries']
        except Exception as e:
            logger.error(f"Error searching YouTube: {str(e)}")
            return []

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    query = request.form.get('query', '')
    if not query:
        return jsonify({'error': 'No search query provided'}), 400

    results = search_youtube(query)
    formatted_results = []

    for result in results:
        if result:
            formatted_result = {
                'title': result.get('title', ''),
                'url': result.get('webpage_url', result.get('url', '')),
                'uploader': result.get('uploader', 'Unknown'),
                'duration': str(int(result.get('duration', 0) // 60)) + ':' + str(int(result.get('duration', 0) % 60)).zfill(2),
                'view_count': result.get('view_count', 0),
                'description': result.get('description', '')[:200] + '...' if result.get('description') else '',
                'upload_date': result.get('upload_date', ''),
                'filesize_approx': result.get('filesize_approx', 0)
            }
            formatted_results.append(formatted_result)

    return jsonify({'results': formatted_results})

@app.route('/download', methods=['POST'])
def download():
    video_url = request.form.get('url')
    format_type = request.form.get('format', 'mp3')

    if not video_url:
        return jsonify({'error': 'No URL provided'}), 400

    try:
        temp_dir = tempfile.mkdtemp()

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'quiet': True,
        }

        if format_type == 'mp3':
            ydl_opts.update({
                'format': 'bestaudio',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }, {
                    'key': 'FFmpegMetadata',
                    'add_metadata': True,
                }],
                'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
                'prefer_ffmpeg': True,
                'keepvideo': False
            })
        else:  # mp4
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]',
                'postprocessors': [{
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                }],
                'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
                'prefer_ffmpeg': True,
                'merge_output_format': 'mp4'
            })

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            filename = ydl.prepare_filename(info)

            # Get correct filename and extension
            if format_type == 'mp3':
                downloaded_files = [f for f in os.listdir(temp_dir) if f.endswith('.mp3')]
                if downloaded_files:
                    filename = os.path.join(temp_dir, downloaded_files[0])
                else:
                    base_name = os.path.splitext(info['title'])[0]
                    filename = os.path.join(temp_dir, f"{base_name}.mp3")
            else:  # mp4
                downloaded_files = [f for f in os.listdir(temp_dir) if f.endswith('.mp4')]
                if downloaded_files:
                    filename = os.path.join(temp_dir, downloaded_files[0])
                else:
                    base_name = os.path.splitext(info['title'])[0]
                    filename = os.path.join(temp_dir, f"{base_name}.mp4")

            # Asegurar que el archivo exista
            if not os.path.exists(filename):
                raise Exception(f"Error: El archivo descargado no se encuentra en el formato {format_type}")

            # Asegurar que el nombre del archivo tenga la extensión correcta
            base_name = os.path.splitext(info['title'])[0]
            safe_filename = "".join(c for c in base_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            
            if format_type == 'mp3':
                download_name = f"{safe_filename}.mp3"
            else:
                download_name = f"{safe_filename}.mp4"

            mime_type = 'audio/mpeg' if format_type == 'mp3' else 'video/mp4'
            return send_file(
                filename,
                as_attachment=True,
                download_name=download_name,
                mimetype=mime_type
            )

    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)