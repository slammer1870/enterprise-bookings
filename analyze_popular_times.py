#!/usr/bin/env python3
"""
Script to analyze lesson and booking data to find the most popular lesson time.
This script processes data from the MCP Payload tools.
"""

import json
from collections import Counter
from datetime import datetime
from typing import Dict, List, Any

def extract_time_from_iso_string(iso_string: str) -> str:
    """
    Extract time component (HH:MM) from an ISO 8601 datetime string.
    
    Args:
        iso_string: ISO 8601 formatted datetime string (e.g., "2024-01-15T10:30:00.000Z")
    
    Returns:
        Time string in HH:MM format (e.g., "10:30")
    """
    try:
        # Parse ISO 8601 string
        dt = datetime.fromisoformat(iso_string.replace('Z', '+00:00'))
        # Return time in HH:MM format
        return dt.strftime('%H:%M')
    except (ValueError, AttributeError) as e:
        print(f"Error parsing time string '{iso_string}': {e}")
        return None

def extract_times_from_lessons(lessons_data: List[Dict[str, Any]]) -> List[str]:
    """
    Extract start times from lesson data.
    
    Args:
        lessons_data: List of lesson objects from findLessons
    
    Returns:
        List of time strings in HH:MM format
    """
    times = []
    for lesson in lessons_data:
        if 'startTime' in lesson and lesson['startTime']:
            time_str = extract_time_from_iso_string(lesson['startTime'])
            if time_str:
                times.append(time_str)
    return times

def extract_times_from_bookings(bookings_data: List[Dict[str, Any]]) -> List[str]:
    """
    Extract start times from booking data (from the lesson object within each booking).
    
    Args:
        bookings_data: List of booking objects from findBookings
    
    Returns:
        List of time strings in HH:MM format
    """
    times = []
    for booking in bookings_data:
        # Check if lesson is an object (not just an ID)
        lesson = booking.get('lesson')
        if lesson and isinstance(lesson, dict) and 'startTime' in lesson:
            time_str = extract_time_from_iso_string(lesson['startTime'])
            if time_str:
                times.append(time_str)
    return times

def find_most_popular_time(times: List[str]) -> tuple:
    """
    Find the most popular time from a list of times.
    
    Args:
        times: List of time strings in HH:MM format
    
    Returns:
        Tuple of (most_popular_time, count)
    """
    if not times:
        return None, 0
    
    counter = Counter(times)
    most_common = counter.most_common(1)[0]
    return most_common[0], most_common[1]

def analyze_popular_times(lessons_data: List[Dict], bookings_data: List[Dict]) -> Dict[str, Any]:
    """
    Analyze lesson and booking data to find popular times.
    
    Args:
        lessons_data: List of lesson objects
        bookings_data: List of booking objects
    
    Returns:
        Dictionary with analysis results
    """
    # Extract times from lessons
    lesson_times = extract_times_from_lessons(lessons_data)
    
    # Extract times from bookings
    booking_times = extract_times_from_bookings(bookings_data)
    
    # Combine all times
    all_times = lesson_times + booking_times
    
    # Find most popular time
    most_popular_time, count = find_most_popular_time(all_times)
    
    # Get top 10 most popular times
    counter = Counter(all_times)
    top_times = counter.most_common(10)
    
    return {
        'most_popular_time': most_popular_time,
        'count': count,
        'total_lessons': len(lessons_data),
        'total_bookings': len(bookings_data),
        'total_time_entries': len(all_times),
        'unique_times': len(counter),
        'top_10_times': top_times,
        'all_time_counts': dict(counter)
    }

if __name__ == "__main__":
    print("This script requires JSON data from the MCP tools.")
    print("Please provide the data as JSON files or modify this script to call the MCP tools directly.")
    print("\nUsage:")
    print("  python analyze_popular_times.py <lessons.json> <bookings.json>")
    print("\nOr modify the script to use the MCP tools directly.")



















