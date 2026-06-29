import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

interface GlobeProps {
  lat: number;
  lng: number;
  isEclipsed: boolean;
}

const Globe: React.FC<GlobeProps> = ({ lat, lng, isEclipsed }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rawTopology, setRawTopology] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // TopoJSON → GeoJSON 변환은 1회만 수행 (useMemo 캐싱)
  const worldData = useMemo(() => {
    if (!rawTopology) return null;
    return topojson.feature(rawTopology, rawTopology.objects.countries);
  }, [rawTopology]);

  // 창 크기에 반응하여 모바일 레이아웃 동적 갱신
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(res => res.json())
      .then(topology => setRawTopology(topology))
      .catch(err => console.error("Failed to load world map data", err));
  }, []);

  const width = isMobile ? 80 : 120;
  const height = isMobile ? 80 : 120;

  useEffect(() => {
    if (!svgRef.current || !worldData) return;

    const svg = d3.select(svgRef.current);

    const projection = d3.geoOrthographic()
      .scale(width / 2 - 2)
      .translate([width / 2, height / 2])
      .rotate([-lng, -lat]);

    const path = d3.geoPath().projection(projection);

    // 기존 대륙/그리드 경로만 업데이트 (완전 재생성 대신 d 속성만 갱신)
    const landPaths = svg.select('.land-group').selectAll<SVGPathElement, any>('path');
    if (landPaths.empty()) {
      // 최초 렌더링: 전체 구조 생성
      svg.selectAll('*').remove();

      const oceanColor = "#0284c7";
      const landColor = "#10b981";
      const landStroke = "#047857";
      const gridColor = "rgba(255,255,255,0.15)";

      // 바다 (배경 원)
      svg.append("circle")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", width / 2 - 2)
        .attr("fill", oceanColor)
        .attr("stroke", "rgba(255,255,255,0.3)")
        .attr("stroke-width", 1);

      // 대륙 (육지)
      svg.append("g")
        .attr("class", "land-group")
        .selectAll("path")
        .data(worldData.features)
        .enter()
        .append("path")
        .attr("d", path as any)
        .attr("fill", landColor)
        .attr("stroke", landStroke)
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.95);

      // 그리드 선
      const graticule = d3.geoGraticule();
      svg.append("path")
        .attr("class", "graticule")
        .datum(graticule)
        .attr("d", path as any)
        .attr("fill", "none")
        .attr("stroke", gridColor)
        .attr("stroke-width", 0.5);

      // ISS 마커 그룹
      const markerGroup = svg.append("g").attr("class", "iss-marker");
      markerGroup.append("circle")
        .attr("class", "pulse-ring")
        .attr("r", 6)
        .attr("fill", "#ef4444")
        .attr("opacity", 0.6);
      markerGroup.append("circle")
        .attr("class", "marker-dot")
        .attr("r", 3)
        .attr("fill", "#ffffff")
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 1.5);
    } else {
      // 업데이트: projection만 변경하고 경로 재계산
      svg.select('.land-group').selectAll<SVGPathElement, any>('path')
        .attr('d', path as any);
      svg.select('.graticule')
        .attr('d', path(d3.geoGraticule()()) as any);
    }

    // ISS 마커 위치 업데이트
    const issPos = projection([lng, lat]);
    const markerGroup = svg.select('.iss-marker');
    if (issPos) {
      markerGroup
        .attr("transform", `translate(${issPos[0]}, ${issPos[1]})`)
        .attr("visibility", "visible");
    } else {
      markerGroup.attr("visibility", "hidden");
    }

  }, [lat, lng, isEclipsed, worldData, width, height]);

  return (
    <div className="relative flex flex-col items-center">
      <style>{`
        .pulse-ring {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.8; }
          50% { transform: scale(2); opacity: 0.1; }
          100% { transform: scale(0.8); opacity: 0.8; }
        }
      `}</style>
      <svg ref={svgRef} width={width} height={height} className="drop-shadow-2xl rounded-full overflow-hidden" />
      <div className="flex mt-2 flex-col items-center gap-0.5">
        <div className="text-[7px] sm:text-[10px] font-mono text-white/80 tracking-widest uppercase font-bold">
          LIVE TRACKER
        </div>
        <div className="text-[6px] sm:text-[8px] font-mono text-white/40 tracking-wider uppercase">
          SPACECRAFT: ISS (ZARYA)
        </div>
        <div className="text-[6px] sm:text-[8px] font-mono text-white/40 tracking-wider uppercase">
          SOURCE: NASA HDEV FEED
        </div>
      </div>
    </div>
  );
};

export default Globe;
