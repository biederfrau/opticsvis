puts File.read(ARGV.first).lines.keep_if { |line| line.include? 'circle' }.map do |line|
  line.match(/(-?\d+\.\d*),(-?\d+\.\d*)/).to_a[1..-1].map(&:to_f)
end.map { |a| a.join ' ' }
