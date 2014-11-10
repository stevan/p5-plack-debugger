package Plack::Debugger::Panel::PerlConfig;

# ABSTRACT: Debug panel for inspecting Perl's config options

use strict;
use warnings;

use Config;

our $VERSION   = '0.01';
our $AUTHORITY = 'cpan:STEVAN';

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'} ||= 'Perl Config';

    $args{'before'} = sub { (shift)->set_result( { %Config } ) };

    $class->SUPER::new( \%args );
}

1;

__END__

=pod

=head1 DESCRIPTION

This is a L<Plack::Debugger::Panel> subclass that will display 
configuration variables that C<perl> was compiled with.

=head1 ACKNOWLEDGMENT

This module was originally developed for Booking.com. With approval 
from Booking.com, this module was generalized and published on CPAN, 
for which the authors would like to express their gratitude.

=cut