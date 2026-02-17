import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ConferenceRow {
  confcode: string;
  psgc: string | null;
  include_psgc: string | null;
  exclude_psgc: string | null;
}

interface LguRow {
  psgc: string;
  lguname: string | null;
  geolevel: string | null;
}

/**
 * Get LGUs for a province under a conference, mirroring PhalgaOnlineRegistration get-lgus logic.
 * See: https://github.com/arkwaretechnologies/PhalgaOnlineRegistration
 */
async function getLgusForProvince(
  conference: ConferenceRow,
  provinceName: string,
  provincePsgc: string | null
): Promise<Array<{ psgc: string; lguname: string | null; geolevel: string | null }>> {
  const provinceUpper = provinceName.trim().toUpperCase();

  // City-class "provinces" (HUC, ICC, CC)
  let cityClass: string | null = null;
  if (provinceUpper === 'HIGHLY URBANIZED CITY') cityClass = 'HUC';
  else if (provinceUpper === 'INDEPENDENT COMPONENT CITY') cityClass = 'ICC';
  else if (provinceUpper === 'COMPONENT CITY') cityClass = 'CC';

  if (cityClass) {
    const seenLGUs = new Set<string>();
    let allLGUs: LguRow[] = [];

    // City-class groups: filter by geolevel CITY and matching city_class.
    // HIGHLY URBANIZED CITY → geolevel CITY + city_class HUC
    // INDEPENDENT COMPONENT CITY → geolevel CITY + city_class ICC
    // COMPONENT CITY → geolevel CITY + city_class CC
    if (!conference.psgc || conference.psgc.trim() === '') {
      const { data: lguData, error: lguError } = await supabase
        .from('lgus')
        .select('lguname, psgc, geolevel, city_class')
        .eq('city_class', cityClass)
        .eq('geolevel', 'CITY')
        .order('lguname', { ascending: true });

      if (lguError) return [];
      allLGUs = (lguData || []).map((row) => ({
        psgc: row.psgc,
        lguname: row.lguname,
        geolevel: row.geolevel,
      }));
    } else {
      const psgcPrefixes = conference.psgc
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p !== '');

      for (const prefix of psgcPrefixes) {
        const { data: lguData, error: lguError } = await supabase
          .from('lgus')
          .select('lguname, psgc, geolevel, city_class')
          .eq('city_class', cityClass)
          .eq('geolevel', 'CITY')
          .ilike('psgc', `${prefix}%`)
          .order('lguname', { ascending: true });

        if (lguError) continue;
        for (const row of lguData || []) {
          if (row.psgc && row.psgc.startsWith(prefix) && row.lguname) {
            const key = `${row.lguname}|${row.psgc}`;
            if (!seenLGUs.has(key)) {
              seenLGUs.add(key);
              allLGUs.push({ psgc: row.psgc, lguname: row.lguname, geolevel: row.geolevel });
            }
          }
        }
      }
      allLGUs.sort((a, b) => (a.lguname || '').localeCompare(b.lguname || ''));
    }

    const excludeRaw = conference.exclude_psgc;
    if (excludeRaw && excludeRaw.trim() !== '') {
      const excludeSet = new Set(
        excludeRaw.split(',').map((p) => p.trim()).filter((p) => p !== '')
      );
      allLGUs = allLGUs.filter((l) => l.psgc && !excludeSet.has(l.psgc));
    }

    return allLGUs;
  }

  // Province-based: need province PSGC
  if (!provincePsgc || provincePsgc.length < 5) return [];

  const firstFiveDigits = provincePsgc.substring(0, 5);
  const psgcPrefix = `${firstFiveDigits}%`;

  const { data: lguData, error: lguError } = await supabase
    .from('lgus')
    .select('lguname, psgc, geolevel')
    .ilike('psgc', psgcPrefix)
    .in('geolevel', ['MUN', 'CITY', 'HUC'])
    .order('lguname', { ascending: true });

  if (lguError) return [];

  let filtered = lguData || [];

  const includePsgcRaw = conference.include_psgc;
  const provinceFirstTwo = provincePsgc.length >= 2 ? provincePsgc.substring(0, 2) : '';
  let applyIncludeFilter = false;
  if (includePsgcRaw && includePsgcRaw.trim() !== '' && provinceFirstTwo !== '') {
    const firstTwoFromInclude = new Set(
      includePsgcRaw
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length >= 2)
        .map((p) => p.substring(0, 2))
    );
    applyIncludeFilter = firstTwoFromInclude.has(provinceFirstTwo);
  }

  if (applyIncludeFilter && includePsgcRaw && includePsgcRaw.trim() !== '') {
    const allowedSet = new Set(
      includePsgcRaw.split(',').map((p) => p.trim()).filter((p) => p !== '')
    );
    filtered = filtered.filter(
      (row) =>
        row.psgc &&
        allowedSet.has(row.psgc) &&
        (row.geolevel === 'MUN' || row.geolevel === 'HUC')
    );
  }

  const excludePsgcRaw = conference.exclude_psgc;
  if (excludePsgcRaw && excludePsgcRaw.trim() !== '') {
    const excludeSet = new Set(
      excludePsgcRaw.split(',').map((p) => p.trim()).filter((p) => p !== '')
    );
    filtered = filtered.filter((row) => row.psgc && !excludeSet.has(row.psgc));
  }

  return filtered.map((row) => ({
    psgc: row.psgc,
    lguname: row.lguname,
    geolevel: row.geolevel,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ confcode: string }> }
) {
  try {
    await requireAuth(['admin']);

    const { confcode } = await params;
    const decoded = decodeURIComponent(confcode);
    if (!decoded?.trim()) {
      return NextResponse.json({ error: 'Conference code is required' }, { status: 400 });
    }

    const { data: conference, error: confError } = await supabase
      .from('conference')
      .select('confcode, psgc, include_psgc, exclude_psgc')
      .eq('confcode', decoded)
      .maybeSingle();

    if (confError || !conference) {
      return NextResponse.json({ error: 'Conference not found' }, { status: 404 });
    }

    // All provinces (geolevel = PROV)
    const { data: provData, error: provError } = await supabase
      .from('lgus')
      .select('psgc, lguname')
      .eq('geolevel', 'PROV')
      .order('lguname', { ascending: true });

    if (provError) {
      return NextResponse.json({ error: 'Failed to fetch provinces' }, { status: 500 });
    }

    const provinces: Array<{
      name: string;
      psgc: string;
      lgus: Array<{ psgc: string; lguname: string | null; geolevel: string | null }>;
    }> = [];

    const provList = provData || [];
    const hasIncludePsgc =
      conference.include_psgc != null && String(conference.include_psgc).trim() !== '';
    const psgcList = (conference.psgc ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length >= 2);
    const allowedProvincePsgcs = new Set(psgcList.filter((s: string) => s.length >= 5));
    const isProvinceAllowed = (provPsgc: string) =>
      allowedProvincePsgcs.has(provPsgc) ||
      psgcList.some((pre: string) => pre.length >= 2 && provPsgc.startsWith(pre));

    // Only return provinces/LGUs assigned to this conference.
    // - When psgc is set: ALWAYS filter provinces by psgc (region/province whitelist). This ensures
    //   conferences with the same psgc (e.g. GCMIN and SAMPLE both "09,10,11,12,16,19") get the same
    //   province list regardless of include_psgc.
    // - When psgc is empty but include_psgc is set: use all provinces; getLgusForProvince filters LGUs.
    // - When both are empty: return no provinces (admin must configure assignment first).
    const provincesToConsider =
      psgcList.length > 0
        ? provList.filter((p) => p.psgc && isProvinceAllowed(p.psgc))
        : hasIncludePsgc
          ? provList
          : [];

    for (const p of provincesToConsider) {
      if (!p.psgc || !p.lguname) continue;
      const lgus = await getLgusForProvince(
        conference as ConferenceRow,
        p.lguname,
        p.psgc
      );
      if (lgus.length > 0) {
        provinces.push({ name: p.lguname, psgc: p.psgc, lgus });
      }
    }

    const cityClassProvinces = [
      { name: 'HIGHLY URBANIZED CITY', psgc: 'HUC' },
      { name: 'INDEPENDENT COMPONENT CITY', psgc: 'ICC' },
      { name: 'COMPONENT CITY', psgc: 'CC' },
    ];
    // Only add city-class groups if conference has psgc (allowed prefixes) or include_psgc
    const includeCityClass = hasIncludePsgc || psgcList.length > 0;
    if (includeCityClass) {
      for (const cc of cityClassProvinces) {
        const lgus = await getLgusForProvince(conference as ConferenceRow, cc.name, null);
        if (lgus.length > 0) {
          provinces.push({ name: cc.name, psgc: cc.psgc, lgus });
        }
      }
    }

    return NextResponse.json({ provinces });
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Conference LGUs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LGUs for conference' },
      { status: 500 }
    );
  }
}
