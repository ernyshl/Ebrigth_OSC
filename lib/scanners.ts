export interface ScannerConfig {
  id:       string;   // logical name used in logs
  location: string;   // branch label written to AttendanceLog.scannerLocation
  ip:       string;
  user:     string;
  pass:     string;
}

export const SCANNERS: ScannerConfig[] = [
  {
    id:       'scanner-1',
    location: 'HQ',
    ip:       process.env.SCANNER_1_IP   ?? '',
    user:     process.env.SCANNER_1_USER ?? '',
    pass:     process.env.SCANNER_1_PASS ?? '',
  },
  // To add a second scanner:
  // {
  //   id:       'scanner-2',
  //   location: 'Sri Petaling',
  //   ip:       process.env.SCANNER_2_IP   ?? '',
  //   user:     process.env.SCANNER_2_USER ?? '',
  //   pass:     process.env.SCANNER_2_PASS ?? '',
  // },
];
