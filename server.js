const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Ensure paintings directory exists
const paintingsDir = path.join(__dirname, 'paintings');
fs.mkdir(paintingsDir, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, paintingsDir);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        cb(null, `cave-painting-${timestamp}.png`);
    }
});

const upload = multer({ storage: storage });

// API Routes

// Save a new painting
app.post('/api/paintings', async (req, res) => {
    try {
        const { imageData, story, artist } = req.body;
        
        if (!imageData || !story) {
            return res.status(400).json({ error: 'Image data and story are required' });
        }

        const timestamp = Date.now();
        const filename = `cave-painting-${timestamp}.png`;
        const filepath = path.join(paintingsDir, filename);
        
        // Convert base64 to image file
        const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
        await fs.writeFile(filepath, base64Data, 'base64');
        
        // Save painting metadata
        const paintingData = {
            id: timestamp,
            filename: filename,
            story: story,
            artist: artist || 'Anonymous Cave Dweller',
            timestamp: timestamp,
            date: new Date(timestamp).toISOString()
        };
        
        const metadataPath = path.join(paintingsDir, `${timestamp}.json`);
        await fs.writeFile(metadataPath, JSON.stringify(paintingData, null, 2));
        
        res.json({ 
            success: true, 
            message: 'Painting saved successfully!',
            id: timestamp 
        });
        
    } catch (error) {
        console.error('Error saving painting:', error);
        res.status(500).json({ error: 'Failed to save painting' });
    }
});

// Get all paintings
app.get('/api/paintings', async (req, res) => {
    try {
        const files = await fs.readdir(paintingsDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const paintings = [];
        
        for (const jsonFile of jsonFiles) {
            try {
                const metadataPath = path.join(paintingsDir, jsonFile);
                const metadata = await fs.readFile(metadataPath, 'utf8');
                const paintingData = JSON.parse(metadata);
                
                // Check if image file exists
                const imagePath = path.join(paintingsDir, paintingData.filename);
                try {
                    await fs.access(imagePath);
                    paintingData.imageUrl = `/paintings/${paintingData.filename}`;
                    paintings.push(paintingData);
                } catch (err) {
                    console.log(`Image file not found: ${paintingData.filename}`);
                }
            } catch (err) {
                console.error(`Error reading metadata file ${jsonFile}:`, err);
            }
        }
        
        // Sort by timestamp (newest first)
        paintings.sort((a, b) => b.timestamp - a.timestamp);
        
        res.json(paintings);
        
    } catch (error) {
        console.error('Error fetching paintings:', error);
        res.status(500).json({ error: 'Failed to fetch paintings' });
    }
});

// Get a specific painting
app.get('/api/paintings/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const metadataPath = path.join(paintingsDir, `${id}.json`);
        
        const metadata = await fs.readFile(metadataPath, 'utf8');
        const paintingData = JSON.parse(metadata);
        
        // Check if image file exists
        const imagePath = path.join(paintingsDir, paintingData.filename);
        await fs.access(imagePath);
        
        paintingData.imageUrl = `/paintings/${paintingData.filename}`;
        res.json(paintingData);
        
    } catch (error) {
        console.error('Error fetching painting:', error);
        res.status(404).json({ error: 'Painting not found' });
    }
});

// Serve painting images
app.use('/paintings', express.static(paintingsDir));

// Serve the gallery page
app.get('/gallery', (req, res) => {
    res.sendFile(path.join(__dirname, 'gallery.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎨 Cave Painting Server running on http://localhost:${PORT}`);
    console.log(`📁 Paintings stored in: ${paintingsDir}`);
    console.log(`🖼️  Gallery available at: http://localhost:${PORT}/gallery`);
});
