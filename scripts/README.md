# AIM CV Export to Google Drive

This script exports all candidate CVs from the AIM Founding to Give database to Google Drive.

## 📋 Setup Instructions

### 1. Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Enter a name (e.g., "AIM CV Exporter")
   - Click "Create and Continue"
   - Skip role assignment (click "Continue")
   - Click "Done"

5. Download credentials:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Select "JSON" format
   - Download the file and rename it to `google-service-account.json`
   - Place it in the `scripts/` directory

### 2. Share Google Drive Folder

1. Open your Google Drive folder: https://drive.google.com/drive/folders/1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN?usp=sharing
2. Click "Share" button
3. Add the service account email (found in the JSON file as `client_email`)
4. Give it "Editor" permissions
5. Click "Send"

### 3. Install Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 4. Run the Script

Make sure your AIM search server is running on localhost:3000, then:

```bash
python export-cvs-to-drive.py
```

## 📁 Output

The script will create:
- **PDF files**: Nicely formatted CVs (e.g., `John_Doe_CV.pdf`)
- **TXT files**: Plain text versions (e.g., `John_Doe_CV.txt`)

Both formats contain:
- Full name and headline
- Contact information (email, LinkedIn)
- Skills and expertise
- Regional experience
- Complete profile content

## ⚙️ Configuration Options

Edit the script to change:

- **Format**: Change `format_type='both'` to `'pdf'` or `'txt'` for single format
- **Folder**: Update `DRIVE_FOLDER_ID` for different destination
- **Credentials**: Update `CREDENTIALS_PATH` for different credential file location

## 🔧 Troubleshooting

**"Credentials file not found"**
- Ensure `google-service-account.json` is in the scripts directory
- Check the filename is exactly correct

**"Permission denied" errors**
- Verify the service account email is shared with the Drive folder
- Ensure it has "Editor" permissions

**"No candidates found"**
- Ensure the AIM server is running (`npm run dev`)
- Check localhost:3000 is accessible

**API quota exceeded**
- The script includes delays to prevent rate limiting
- If you hit limits, wait and run again

## 📊 Expected Output

```
✅ Google Drive API initialized successfully
🔍 Fetching all candidates from AIM database...
✅ Found 755 candidates in database
🚀 Starting CV export process (format: both)
📄 Processing 1/755: Dr. Sarah Chen
   ✅ PDF uploaded: Dr_Sarah_Chen_CV.pdf
   ✅ TXT uploaded: Dr_Sarah_Chen_CV.txt
📄 Processing 2/755: Abubakar Salihu
   ✅ PDF uploaded: Abubakar_Salihu_CV.pdf
   ✅ TXT uploaded: Abubakar_Salihu_CV.txt
...
🎉 Export complete!
✅ Successfully uploaded: 1510 files
❌ Failed uploads: 0 files
📁 Files uploaded to: https://drive.google.com/drive/folders/1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN
```

The script will export all ~755 candidates as both PDF and TXT files (1510 total files) to your Google Drive folder.