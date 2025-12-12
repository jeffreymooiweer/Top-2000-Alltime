import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { SongData } from '../types';

/**
 * Export songs to Excel format
 */
export const exportToExcel = (songs: SongData[], selectedYear: string = 'all-time'): void => {
  // Prepare data for Excel
  const excelData = songs.map((song, index) => {
    const row: any = {
      'Rank': selectedYear === 'all-time' ? (song.allTimeRank || index + 1) : (song.rankings[selectedYear] || ''),
      'Artiest': song.artist,
      'Titel': song.title,
      'Jaar': song.releaseYear > 0 ? song.releaseYear : '',
      'Score': song.totalScore || 0,
    };

    // Add ranking for selected year if not all-time
    if (selectedYear !== 'all-time') {
      row[`Rank ${selectedYear}`] = song.rankings[selectedYear] || '';
    }

    return row;
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 8 },  // Rank
    { wch: 30 }, // Artiest
    { wch: 40 }, // Titel
    { wch: 8 },  // Jaar
    { wch: 12 }, // Score
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Top 2000');

  // Generate filename
  const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
  const filename = `Top-2000-${yearLabel}-${new Date().toISOString().split('T')[0]}.xlsx`;

  // Write file
  XLSX.writeFile(wb, filename);
};

/**
 * Export songs to PDF format
 */
export const exportToPDF = (songs: SongData[], selectedYear: string = 'all-time'): void => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const rowHeight = 8;
  const startY = 20;
  let currentY = startY;

  // Title
  doc.setFontSize(20);
  doc.setTextColor(217, 0, 24); // NPO Red
  const yearLabel = selectedYear === 'all-time' ? 'Allertijden' : selectedYear;
  doc.text(`NPO Radio 2 Top 2000 - ${yearLabel}`, margin, currentY);
  
  currentY += 10;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')}`, margin, currentY);
  currentY += 8;

  // Table headers
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text('Rank', margin, currentY);
  doc.text('Artiest', margin + 15, currentY);
  doc.text('Titel', margin + 60, currentY);
  doc.text('Jaar', margin + 120, currentY);
  doc.text('Score', margin + 135, currentY);
  
  currentY += 5;
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  // Table rows
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9);
  
  songs.forEach((song, index) => {
    // Check if we need a new page
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = startY;
    }

    const rank = selectedYear === 'all-time' ? (song.allTimeRank || index + 1) : (song.rankings[selectedYear] || '');
    
    doc.text(String(rank), margin, currentY);
    doc.text(song.artist.substring(0, 25), margin + 15, currentY);
    doc.text(song.title.substring(0, 35), margin + 60, currentY);
    doc.text(song.releaseYear > 0 ? String(song.releaseYear) : '', margin + 120, currentY);
    doc.text(String(song.totalScore || 0), margin + 135, currentY);
    
    currentY += rowHeight;
  });

  // Save PDF
  const filename = `Top-2000-${yearLabel}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
};

/**
 * Export to Spotify playlist format (CSV with search links)
 * Users can import this CSV or use the search links to create a playlist
 */
export const exportToSpotify = (songs: SongData[]): void => {
  const csvRows = ['Title,Artist,Spotify Search URL'];
  
  songs.forEach((song) => {
    const searchQuery = encodeURIComponent(`${song.artist} ${song.title}`);
    csvRows.push(`"${song.title}","${song.artist}","https://open.spotify.com/search/${searchQuery}"`);
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Top-2000-Spotify-Playlist-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export to Deezer playlist format (CSV with search links)
 */
export const exportToDeezer = (songs: SongData[]): void => {
  const csvRows = ['Title,Artist,Deezer Search URL'];
  
  songs.forEach((song) => {
    const searchQuery = encodeURIComponent(`${song.artist} ${song.title}`);
    csvRows.push(`"${song.title}","${song.artist}","https://www.deezer.com/search/${searchQuery}"`);
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Top-2000-Deezer-Playlist-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export to YouTube Music playlist format (CSV)
 */
export const exportToYouTubeMusic = (songs: SongData[]): void => {
  // YouTube Music accepts CSV format for playlist import
  const csvRows = ['Title,Artist'];
  
  songs.forEach((song) => {
    csvRows.push(`"${song.title}","${song.artist}"`);
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Top-2000-YouTube-Music-Playlist-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Export for 3rd party transfer tools (Soundiiz, TuneMyMusic, etc.)
 * Creates a standard CSV with Title, Artist, Year
 */
export const exportForTransfer = (songs: SongData[]): void => {
  const csvRows = ['Title,Artist,Year,Rank'];
  
  songs.forEach((song, index) => {
    // Escape quotes in fields
    const title = song.title.replace(/"/g, '""');
    const artist = song.artist.replace(/"/g, '""');
    const year = song.releaseYear > 0 ? song.releaseYear : '';
    const rank = song.allTimeRank || index + 1;
    
    csvRows.push(`"${title}","${artist}","${year}","${rank}"`);
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Top-2000-Transfer-Export-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

