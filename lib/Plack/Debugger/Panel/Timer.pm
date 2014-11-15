package Plack::Debugger::Panel::Timer;

# ABSTRACT: Debug panel for inspecting page generation timing

use strict;
use warnings;

use Time::HiRes qw[ gettimeofday tv_interval ];

our $VERSION   = '0.02';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'}     ||= 'Timer';
    $args{'formatter'} ||= 'ordered_key_value_pairs';

    $args{'before'} = sub {
        my ($self, $env) = @_;
        $self->stash([ gettimeofday ]);
    };

    $args{'after'} = sub {
        my ($self, $env, $resp) = @_;
        
        my $start   = $self->stash;
        my $end     = [ gettimeofday ];
        my $elapsed = tv_interval( $start, $end ); 

        $self->set_subtitle( $elapsed );
        $self->set_result([
            'Elapsed Time'  => $elapsed,
            'Starting Time' => $class->format_time( $start ),
            'Ending Time'   => $class->format_time( $end ),
        ]);
    };

    $class->SUPER::new( \%args );
}

sub format_time {
    my (undef, $time) = @_;
    my ($sec, $min, $hour, $mday, $mon, $year) = ( localtime( $time->[0] ) );
    sprintf "%04d.%02d.%02d %02d:%02d:%02d.%d" => ( 
        $year + 1900, 
        $mon + 1, 
        $mday,
        $hour, 
        $min, 
        $sec, 
        $time->[1]
    );
}

1;

__END__

=head1 DESCRIPTION

This is a L<Plack::Debugger::Panel> subclass that will gather timing
data during the request. 

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.


