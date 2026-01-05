import React from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
} from '@mui/material';
import { History as HistoryIcon, Visibility, Delete } from '@mui/icons-material';

const mockHistory = [
  { id: 1, date: '2025-09-18', type: 'Technical', duration: '25 min', score: 78, status: 'completed' },
  { id: 2, date: '2025-09-16', type: 'Behavioral', duration: '18 min', score: 81, status: 'completed' },
  { id: 3, date: '2025-09-14', type: 'Mixed', duration: '22 min', score: 68, status: 'completed' },
  { id: 4, date: '2025-09-12', type: 'Technical', duration: '30 min', score: 72, status: 'completed' },
  { id: 5, date: '2025-09-10', type: 'Behavioral', duration: '20 min', score: 65, status: 'completed' },
];

export default function HistoryPage() {
  const getScoreColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          Interview History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review all your past interview sessions
        </Typography>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockHistory.map((session) => (
                <TableRow key={session.id} hover>
                  <TableCell>{session.date}</TableCell>
                  <TableCell>
                    <Chip
                      label={session.type}
                      size="small"
                      color={
                        session.type === 'Technical' ? 'primary' :
                        session.type === 'Behavioral' ? 'secondary' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>{session.duration}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${session.score}%`}
                      color={getScoreColor(session.score)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={session.status}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" color="primary">
                      <Visibility />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}
