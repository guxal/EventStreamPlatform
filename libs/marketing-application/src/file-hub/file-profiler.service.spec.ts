import { Readable } from 'stream';
import { FileProfilerService } from './file-profiler.service';

describe('FileProfilerService', () => {
  const service = new FileProfilerService({} as never);

  it('profiles CSV headers, rows, samples and checksum from a stream', async () => {
    const csv = 'Campaign,Clicks,Cost\nBrand,10,5.25\nNon Brand,20,12.50\n';
    const result = await service.profileCsvStream(Readable.from(csv), Buffer.byteLength(csv));

    expect(result.headers).toEqual(['Campaign', 'Clicks', 'Cost']);
    expect(result.rowCount).toBe(2);
    expect(result.sampleRows).toEqual([
      { Campaign: 'Brand', Clicks: '10', Cost: '5.25' },
      { Campaign: 'Non Brand', Clicks: '20', Cost: '12.50' },
    ]);
    expect(result.sizeBytes).toBe(Buffer.byteLength(csv));
    expect(result.checksum).toHaveLength(64);
    expect(result.isEmpty).toBe(false);
  });

  it('flags header-only files as empty', async () => {
    const csv = 'Campaign,Clicks,Cost\n';
    const result = await service.profileCsvStream(Readable.from(csv), Buffer.byteLength(csv));

    expect(result.isEmpty).toBe(true);
    expect(result.warnings).toContain('EMPTY_OR_HEADER_ONLY_FILE');
  });
});
