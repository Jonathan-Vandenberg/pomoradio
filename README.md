# 🍅🌍 Poma Radio - Global Pomodoro Timer

A beautiful Pomodoro timer that plays radio music from around the world during your breaks, featuring an interactive 3D globe interface inspired by RadioGarden.

## ✨ Features

### 🍅 Pomodoro Timer
- **25-minute work sessions** with 5-minute short breaks
- **15-minute long breaks** after every 4 work sessions
- **Smart audio management**: Radio plays only during breaks
- **Smooth fade effects**: Music fades in/out with customizable timing
- **Session tracking**: Keep track of completed cycles

### 🌍 Interactive Globe
- **3D Earth visualization** with 252 radio stations from 114 countries
- **Lightning-fast loading** with pre-cached station data (120KB JSON file)
- **Quality-coded markers**: Green (high), Yellow (medium), Orange (standard), Red (basic)
- **Click to listen**: Tap any station on the globe to play it
- **Smart auto-rotation**: Pauses on interaction, resumes after 15 seconds idle
- **Global coverage**: Stations from USA, Germany, Mexico, Netherlands, Canada, and 109+ more countries

### 📱 Responsive Design
- **Collapsible sidebar** on mobile with all timer controls
- **Touch-friendly globe** interaction for mobile devices
- **Dark theme optimized** for focus and eye comfort
- **Real-time status** showing current country and station info

### 🎵 Audio Features
- **Automatic server discovery** with failover support
- **Volume control** with live adjustment
- **Station metadata** display (country, quality, codec)
- **Click tracking** to support the radio-browser database

## 🚀 Getting Started

1. **Install dependencies**:
```bash
npm install
```

2. **Run the development server**:
```bash
npm run dev
```

3. **Open your browser**:
Navigate to [http://localhost:3000](http://localhost:3000)

### 📡 Radio Stations Data

The app uses pre-cached radio station data for lightning-fast loading. The current dataset includes **252 stations from 114 countries** worldwide.

**To regenerate the data** (optional):
```bash
npm run generate-stations
```

This will fetch fresh data from the Radio-Browser API and update the `/public/radio-stations.json` file. The globe will automatically use this updated data on the next reload.

## 🎮 How to Use

1. **Start your Pomodoro session** using the timer controls in the sidebar
2. **Focus during work time** - the globe shows available stations but won't play music
3. **Enjoy breaks** - Radio automatically starts with a smooth fade-in effect
4. **Explore the globe** - Click on any station marker to change the music
5. **Customize volume** using the slider in the sidebar
6. **Track progress** with the session counter and cycle display

## 🛠 Technical Stack

- **Next.js 15** with React 19 and TypeScript
- **Tailwind CSS v4** for modern styling
- **react-globe.gl** for the interactive 3D globe
- **Three.js** for 3D rendering and animations
- **Radio-Browser API** for real-time radio station data
- **Web Audio API** for smooth fade effects

## 🌐 API Integration

This app integrates with the free [Radio-Browser API](https://api.radio-browser.info/):
- Automatic server discovery and rotation
- Real-time station data from around the world
- Click tracking to support the open-source database
- Respectful API usage with proper user agents

## 🎯 Productivity Philosophy

Poma Radio follows the proven Pomodoro Technique while adding a global twist:
- **Work sessions**: Complete focus without audio distractions
- **Break time**: Discover new cultures through their radio stations
- **Gentle transitions**: Smooth audio fades signal phase changes
- **Global awareness**: Learn about different countries during breaks

## 📸 Screenshots

The interface features a beautiful split layout:
- **Left**: Compact sidebar with timer, controls, and radio status
- **Right**: Immersive 3D globe showing stations worldwide
- **Mobile**: Collapsible sidebar overlay for touch devices

---

*Stay focused, explore the world, one Pomodoro at a time.* 🍅🌍
# pomoradio
